import { getStore } from "@netlify/blobs";
import { X509Certificate } from "node:crypto";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

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

function decodeCertSerial(content: string): string | null {
  const pem = extractPem(content);
  if (!pem) return null;

  try {
    const cert = new X509Certificate(pem);
    return BigInt("0x" + cert.serialNumber).toString();
  } catch {
    return null;
  }
}

interface HistoryEntry {
  version: string;
  serial: string;
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

export default async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "GET") {
    const versionQuery = url.searchParams.get("v");
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

    const index = await getHistoryIndex();
    return new Response(JSON.stringify(index), {
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
      const { content, version } = body as { content?: string; version?: string };
      if (!content || !version) {
        return new Response("Missing content or version", { status: 400 });
      }
      const serial = decodeCertSerial(content);
      if (!serial) {
        return new Response("Could not decode certificate", { status: 400 });
      }
      const index = await getHistoryIndex();
      const existing = index.find(e => e.version === version);
      if (existing) {
        existing.serial = serial;
        existing.timestamp = new Date().toISOString();
      } else {
        index.push({ version, serial, timestamp: new Date().toISOString() });
      }
      await saveHistoryIndex(index);
      const store = getHistoryStore();
      await store.set(`content:${version}`, content);
      return new Response(JSON.stringify({ version, serial }), { status: 200 });
    }

    const entries = body as Array<{ version?: string; content?: string }>;
    if (!Array.isArray(entries)) {
      return new Response("Expected array", { status: 400 });
    }

    const index = await getHistoryIndex();
    const store = getHistoryStore();
    const results: Array<{ version: string; serial: string; status: string }> = [];

    for (const entry of entries) {
      if (!entry.version || !entry.content) {
        results.push({ version: entry.version ?? "?", serial: "", status: "skipped: missing fields" });
        continue;
      }
      const serial = decodeCertSerial(entry.content);
      if (!serial) {
        results.push({ version: entry.version, serial: "", status: "skipped: could not decode" });
        continue;
      }
      const existing = index.find(e => e.version === entry.version);
      if (!existing) {
        index.push({ version: entry.version, serial, timestamp: new Date().toISOString() });
      }
      await store.set(`content:${entry.version}`, entry.content);
      results.push({ version: entry.version, serial, status: "ok" });
    }

    await saveHistoryIndex(index);
    return new Response(JSON.stringify({ imported: results.length, results }), { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
