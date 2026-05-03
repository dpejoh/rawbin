import { getStore } from "@netlify/blobs";
import { X509Certificate } from "node:crypto";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;
const GOOGLE_REVOCATION_URL = "https://android.googleapis.com/attestation/status?encrypted=1";
const RE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

function hexToDecimal(hex: string): string | null {
  const cleaned = hex.replace(/^0+/, "") || "0";
  if (cleaned.length <= 16) {
    return BigInt("0x" + cleaned).toString();
  }
  return null;
}

async function checkGoogleRevocation(serial: string): Promise<boolean> {
  try {
    const res = await fetch(GOOGLE_REVOCATION_URL);
    if (!res.ok) return false;
    const text = await res.text();
    const dec = hexToDecimal(serial);
    if (dec && text.includes(dec)) return true;
    if (text.toLowerCase().includes(serial.toLowerCase())) return true;
    return false;
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
  serial: string;
  revoked: boolean;
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

function computeLatestPerSource(index: HistoryEntry[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const entry of index) {
    const existing = parseInt(latest[entry.source] ?? "0", 10);
    const candidate = parseInt(entry.version, 10);
    if (!isNaN(candidate) && candidate > existing) {
      latest[entry.source] = entry.version;
    }
  }
  return latest;
}

function findWorking(index: HistoryEntry[], latest: Record<string, string>): { source: string; version: string } | null {
  let best: { source: string; version: string } | null = null;
  let bestVer = 0;
  for (const entry of index) {
    if (entry.revoked) continue;
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

    if (versionQuery) {
      const store = getHistoryStore();
      const content = await store.get(`content:${versionQuery}`);
      if (!content) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (serialQuery) {
      const entry = index.find(e => e.serial === serialQuery);
      if (!entry) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(JSON.stringify(entry), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const changed = await reCheckRevocations(index);
    if (changed) await saveHistoryIndex(index);

    const latest = computeLatestPerSource(index);
    const working = findWorking(index, latest);

    return new Response(JSON.stringify({ entries: index, latest, working }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
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

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (isSave) {
      const { content, version, source } = body as { content?: string; version?: string; source?: string };
      if (!content || !version) {
        return new Response("Missing content or version", { status: 400 });
      }
      const serial = decodeCertSerial(content);
      if (!serial) {
        return new Response("Could not decode certificate", { status: 400 });
      }

      const src = source || "yuri";
      const isRevoked = await checkGoogleRevocation(serial);
      const now = new Date().toISOString();

      const index = await getHistoryIndex();
      const existing = index.find(e => e.source === src && e.version === version);
      if (existing) {
        existing.serial = serial;
        existing.revoked = isRevoked;
        existing.last_checked = now;
        existing.timestamp = now;
      } else {
        index.push({ source: src, version, serial, revoked: isRevoked, last_checked: now, timestamp: now });
      }
      await saveHistoryIndex(index);

      const store = getHistoryStore();
      await store.set(`content:${src}:${version}`, content);

      return new Response(JSON.stringify({ source: src, version, serial, revoked: isRevoked }), { status: 200 });
    }

    const entries = body as Array<{ source?: string; version?: string; content?: string }>;
    if (!Array.isArray(entries)) {
      return new Response("Expected array", { status: 400 });
    }

    const index = await getHistoryIndex();
    const store = getHistoryStore();
    const results: Array<{ source: string; version: string; status: string }> = [];

    for (const entry of entries) {
      if (!entry.version || !entry.content) {
        results.push({ source: entry.source ?? "?", version: entry.version ?? "?", status: "skipped: missing fields" });
        continue;
      }
      const serial = decodeCertSerial(entry.content);
      if (!serial) {
        results.push({ source: entry.source ?? "?", version: entry.version, status: "skipped: could not decode" });
        continue;
      }

      const src = entry.source || "yuri";
      const isRevoked = await checkGoogleRevocation(serial);
      const now = new Date().toISOString();

      const existing = index.find(e => e.source === src && e.version === entry.version);
      if (!existing) {
        index.push({ source: src, version: entry.version, serial, revoked: isRevoked, last_checked: now, timestamp: now });
      }
      await store.set(`content:${src}:${entry.version}`, entry.content);
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
