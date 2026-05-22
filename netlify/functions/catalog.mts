import { getStore } from "@netlify/blobs";
import { X509Certificate } from "node:crypto";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;
const GOOGLE_REVOCATION_URL = "https://android.googleapis.com/attestation/status";
const RE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CORS = { "Access-Control-Allow-Origin": "*" };

async function verifyToken(token: string): Promise<{ email: string; id: string } | null> {
  try {
    const res = await fetch(`${SITE_URL}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; id: string; sub?: string };
    return { email: data.email ?? "", id: data.id ?? data.sub ?? "" };
  } catch {
    return null;
  }
}

function extractPem(content: string): string | null {
  const certMatch = content.match(/<Certificate\b[^>]*>([\s\S]*?)<\/Certificate>/);
  if (!certMatch) return null;
  const pemRaw = certMatch[1];
  if (!pemRaw) return null;
  let pem = pemRaw.trim();
  pem = pem.replace(/<!--[\s\S]*?-->/g, "");
  pem = pem.trim();
  if (!pem.startsWith("-----BEGIN ")) {
    pem = "-----BEGIN CERTIFICATE-----\n" + pem + "\n-----END CERTIFICATE-----";
  }
  return pem;
}

function hexToDecimal(hex: string): string {
  const cleaned = hex.replace(/^0+/, "") || "0";
  return BigInt("0x" + cleaned).toString();
}

async function checkGoogleRevocation(serial: string): Promise<boolean> {
  try {
    const res = await fetch(GOOGLE_REVOCATION_URL);
    if (!res.ok) return false;
    const data = await res.json() as { entries: Record<string, unknown> };
    const revokedKeys = Object.keys(data.entries ?? {});

    const decForm = hexToDecimal(serial);
    const hexPadded = serial.padStart(32, '0');

    return revokedKeys.some(key =>
      key === serial || key === hexPadded || key === decForm
    );
  } catch {
    return false;
  }
}

function decodeCertSerial(content: string): string | null {
  const pem = extractPem(content);
  if (!pem) return null;
  try {
    const cert = new X509Certificate(pem);
    return cert.serialNumber.toLowerCase().replace(/^0+/, "") || "0";
  } catch {
    return null;
  }
}

interface HistoryEntry {
  source: string;
  version: string;
  text: string;
  serial: string;
  revoked: boolean;
  softbanned: boolean;
  last_checked: string;
  timestamp: string;
}

function getHistoryStore() {
  return getStore("keybox-history");
}

async function getHistoryIndex(): Promise<HistoryEntry[]> {
  const store = getHistoryStore();
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as HistoryEntry[];
}

async function saveHistoryIndex(index: HistoryEntry[]): Promise<void> {
  const store = getHistoryStore();
  await store.set("index", JSON.stringify(index));
}

async function getContentMeta(key: string): Promise<{ useBase64: boolean } | null> {
  const store = getHistoryStore();
  const raw = await store.get(`meta:${key}`);
  if (!raw) return null;
  return JSON.parse(raw) as { useBase64: boolean };
}

async function setContentMeta(key: string, meta: { useBase64: boolean }): Promise<void> {
  const store = getHistoryStore();
  await store.set(`meta:${key}`, JSON.stringify(meta));
}

async function reCheckRevocations(index: HistoryEntry[]): Promise<boolean> {
  let changed = false;
  const now = Date.now();
  for (const entry of index) {
    if (entry.revoked) continue;
    const checked = new Date(entry.last_checked).getTime();
    if (now - checked < RE_CHECK_INTERVAL_MS) continue;
    const isRevoked = await checkGoogleRevocation(entry.serial);
    if (isRevoked) {
      entry.revoked = true;
      entry.last_checked = new Date().toISOString();
      changed = true;
    } else {
      entry.last_checked = new Date().toISOString();
      changed = true;
    }
  }
  return changed;
}

interface AutoOverride {
  source: string;
  version?: string;
}

function computeLatestPerSource(index: HistoryEntry[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const entry of index) {
    if (!entry.source) continue;
    const existing = parseInt(latest[entry.source] ?? "0", 10);
    const candidate = parseInt(entry.version, 10);
    if (!isNaN(candidate) && candidate > existing) {
      latest[entry.source] = entry.version;
    }
  }
  return latest;
}

async function getAutoOverride(): Promise<AutoOverride | null> {
  const store = getHistoryStore();
  const raw = await store.get("auto-override");
  if (!raw) return null;
  return JSON.parse(raw) as AutoOverride;
}

async function setAutoOverride(override: AutoOverride): Promise<void> {
  const store = getHistoryStore();
  await store.set("auto-override", JSON.stringify(override));
}

async function clearAutoOverride(): Promise<void> {
  const store = getHistoryStore();
  await store.delete("auto-override");
}

async function findWorking(index: HistoryEntry[]): Promise<{ source: string; version: string } | null> {
  const autoOverride = await getAutoOverride();
  if (autoOverride) {
    let entries: HistoryEntry[];
    if (autoOverride.version) {
      entries = index.filter(e => e.source === autoOverride.source && e.version === autoOverride.version);
    } else {
      entries = index.filter(e => e.source === autoOverride.source);
    }
    const valid = entries.filter(e => !e.revoked && !e.softbanned);
    if (valid.length > 0) {
      let best = valid[0];
      let bestVer = parseInt(best.version, 10);
      for (const entry of valid) {
        const v = parseInt(entry.version, 10);
        if (!isNaN(v) && v > bestVer) {
          bestVer = v;
          best = entry;
        }
      }
      return { source: best.source, version: best.version };
    }
  }
  let best: { source: string; version: string } | null = null;
  let bestVer = 0;
  for (const entry of index) {
    if (!entry.source || entry.revoked || entry.softbanned) continue;
    const v = parseInt(entry.version, 10);
    if (!isNaN(v) && v > bestVer) {
      bestVer = v;
      best = { source: entry.source, version: entry.version };
    }
  }
  return best;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "GET") {
    const versionQuery = url.searchParams.get("v");
    const serialQuery = url.searchParams.get("serial");
    const index = await getHistoryIndex();

    let needsSave = false;
    for (const entry of index) {
      if (!entry.source) {
        entry.source = "unknown";
        needsSave = true;
      }
      if (!entry.text) {
        entry.text = entry.version;
        needsSave = true;
      }
    }
    if (needsSave) await saveHistoryIndex(index);

    const recheckQuery = url.searchParams.get("recheck");
    if (recheckQuery) {
      const colon = recheckQuery.indexOf(":");
      const src = colon >= 0 ? recheckQuery.slice(0, colon) : "";
      const ver = colon >= 0 ? recheckQuery.slice(colon + 1) : recheckQuery;
      const entry = index.find(e => e.source === src && e.version === ver);
      if (!entry) return new Response("Not found", { status: 404 });
      const isRevoked = await checkGoogleRevocation(entry.serial);
      entry.revoked = isRevoked;
      entry.last_checked = new Date().toISOString();
      await saveHistoryIndex(index);
      return new Response(JSON.stringify(serializeEntry(entry)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (versionQuery) {
      const store = getHistoryStore();
      const content = await store.get(`content:${versionQuery}`);
      if (!content) {
        return new Response("Not found", { status: 404 });
      }
      const meta = await getContentMeta(versionQuery);
      const decoded = meta?.useBase64 ? Buffer.from(content, "base64").toString() : content;
      return new Response(decoded, {
        status: 200,
        headers: { "Content-Type": "text/plain", ...CORS },
      });
    }

    if (serialQuery) {
      const entry = index.find(e => e.serial === serialQuery);
      if (!entry) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(JSON.stringify(serializeEntry(entry)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const changed = await reCheckRevocations(index);
    if (changed) await saveHistoryIndex(index);

    const latest = computeLatestPerSource(index);
    const working = await findWorking(index);
    const autoOverride = await getAutoOverride();

    return new Response(JSON.stringify({ entries: index.map(serializeEntry), latest, working, autoOverride }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (method === "POST") {
    const path = url.pathname;
    const isSave = path.endsWith("/save");
    const isSetStatus = path.endsWith("/set-status");
    const isSetAutoOverride = path.endsWith("/set-auto-override");
    const isClearAutoOverride = path.endsWith("/clear-auto-override");

    if (isClearAutoOverride) {
      await clearAutoOverride();
      return new Response(JSON.stringify({ autoOverride: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (isSetAutoOverride) {
      const { source, version } = body as { source?: string; version?: string };
      if (!source) {
        return new Response("Missing source", { status: 400 });
      }
      const override: AutoOverride = version ? { source, version } : { source };
      await setAutoOverride(override);
      return new Response(JSON.stringify({ autoOverride: override }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (isSetStatus) {
      const { source, version, status } = body as { source?: string; version?: string; status?: string };
      if (!source || !version || !status) {
        return new Response("Missing source, version, or status", { status: 400 });
      }
      if (!["active", "softbanned", "revoked"].includes(status)) {
        return new Response("Invalid status", { status: 400 });
      }
      const index = await getHistoryIndex();
      const entry = index.find(e => e.source === source && e.version === version);
      if (!entry) {
        return new Response("Not found", { status: 404 });
      }
      entry.softbanned = status === "softbanned";
      entry.revoked = status === "revoked";
      if (status === "revoked") entry.last_checked = new Date().toISOString();
      await saveHistoryIndex(index);
      return new Response(JSON.stringify(serializeEntry(entry)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (isSave) {
      const { content, version, source, text, useBase64 } = body as { content?: string; version?: string; source?: string; text?: string; useBase64?: boolean };
      if (!content || !version || !source) {
        return new Response("Missing content, version, or source", { status: 400 });
      }
      const serial = decodeCertSerial(content);
      if (!serial) {
        return new Response("Could not decode certificate", { status: 400 });
      }

      const src = source;
      const txt = text ?? version;
      const isRevoked = await checkGoogleRevocation(serial);
      const now = new Date().toISOString();

      const index = await getHistoryIndex();
      const existing = index.find(e => e.source === src && e.version === version);
      if (existing) {
        existing.text = txt;
        existing.serial = serial;
        existing.revoked = isRevoked;
        existing.last_checked = now;
        existing.timestamp = now;
      } else {
        index.push({ source: src, version, text: txt, serial, revoked: isRevoked, softbanned: false, last_checked: now, timestamp: now });
      }
      await saveHistoryIndex(index);

      const store = getHistoryStore();
      const storedContent = useBase64 ? Buffer.from(content).toString("base64") : content;
      await store.set(`content:${src}:${version}`, storedContent);
      await setContentMeta(`${src}:${version}`, { useBase64: !!useBase64 });

      return new Response(JSON.stringify({ source: src, version, serial, revoked: isRevoked, softbanned: false }), { status: 200 });
    }

    const entries = body as Array<{ source?: string; version?: string; content?: string; text?: string; useBase64?: boolean }>;
    if (!Array.isArray(entries)) {
      return new Response("Expected array", { status: 400 });
    }

    const index = await getHistoryIndex();
    const store = getHistoryStore();
    const results: Array<{ source: string; version: string; status: string }> = [];

    for (const entry of entries) {
      if (!entry.version || !entry.content || !entry.source) {
        results.push({ source: entry.source ?? "?", version: entry.version ?? "?", status: "skipped: missing fields" });
        continue;
      }
      const serial = decodeCertSerial(entry.content);
      if (!serial) {
        results.push({ source: entry.source, version: entry.version, status: "skipped: could not decode" });
        continue;
      }

      const src = entry.source;
      const txt = entry.text ?? entry.version;
      const isRevoked = await checkGoogleRevocation(serial);
      const now = new Date().toISOString();

      const existing = index.find(e => e.source === src && e.version === entry.version);
      if (!existing) {
        index.push({ source: src, version: entry.version, text: txt, serial, revoked: isRevoked, softbanned: false, last_checked: now, timestamp: now });
      } else {
        existing.text = txt;
      }
      const storedContent = entry.useBase64 ? Buffer.from(entry.content).toString("base64") : entry.content;
      await store.set(`content:${src}:${entry.version}`, storedContent);
      await setContentMeta(`${src}:${entry.version}`, { useBase64: !!entry.useBase64 });
      results.push({ source: src, version: entry.version, status: "ok" });
    }

    await saveHistoryIndex(index);
    return new Response(JSON.stringify({ imported: results.length, results }), { status: 200 });
  }

  if (method === "DELETE") {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { source, version } = body as { source?: string; version?: string };
    if (!source || !version) {
      return new Response("Missing source or version", { status: 400 });
    }

    const index = await getHistoryIndex();
    const idx = index.findIndex(e => e.source === source && e.version === version);
    if (idx === -1) {
      return new Response("Not found", { status: 404 });
    }

    index.splice(idx, 1);
    await saveHistoryIndex(index);

    const store = getHistoryStore();
    await store.delete(`content:${source}:${version}`);

    return new Response("Deleted", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

function serializeEntry(e: HistoryEntry): Record<string, unknown> {
  return {
    source: e.source,
    version: e.version,
    text: e.text,
    revoked: e.revoked,
    softbanned: e.softbanned,
    serial: e.serial,
    last_checked: e.last_checked,
    timestamp: e.timestamp,
  };
}
