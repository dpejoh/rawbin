import { getStore } from "@netlify/blobs";

const RAV_B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const RAV_SHFL = "1dgWnocayqxU3r6vA5lCIPYfHmkV08b4tz+KMsp2NQ9LRXihODwSj7BEFJ/ZuGTe";

const BLOCKED_AGENTS = ["googlebot", "bingbot", "baiduspider", "crawler", "spider", "scraper"];
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 60_000;

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

interface HistoryEntry {
  source: string;
  version: string;
  serial: string;
  revoked: boolean;
  softbanned: boolean;
  last_checked: string;
  timestamp: string;
}

interface HistoryResponse {
  entries: HistoryEntry[];
  latest: Record<string, string>;
  working: { source: string; version: string } | null;
}

let cachedHistory: { data: HistoryResponse; fetchedAt: number } | null = null;

async function fetchHistory(): Promise<HistoryResponse | null> {
  if (cachedHistory && Date.now() - cachedHistory.fetchedAt < CACHE_TTL_MS) {
    return cachedHistory.data;
  }
  try {
    const res = await fetch(`${SITE_URL}/.netlify/functions/catalog`);
    if (!res.ok) return null;
    const data = await res.json() as HistoryResponse;
    cachedHistory = { data, fetchedAt: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    const segments = path.split("/").filter(Boolean);
    const isKeyPrefix = segments[0] === "key";
    const provider = isKeyPrefix ? (segments[1] ?? null) : (segments[0] ?? null);
    const ver = isKeyPrefix ? (segments[2] ?? null) : (segments[1] ?? null);

    const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
    if (BLOCKED_AGENTS.some((bot) => ua.includes(bot))) {
      return new Response("Forbidden", { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("client-ip") ?? "unknown";

    try {
      const rateStore = getStore("rate-limit");
      const now = Date.now();
      const rateKey = `rl:${ip}`;
      const existing = await rateStore.get(rateKey);
      const record: { count: number; windowStart: number } = existing
        ? (JSON.parse(existing) as { count: number; windowStart: number })
        : { count: 0, windowStart: now };

      if (now - record.windowStart > RATE_WINDOW_MS) {
        record.count = 0;
        record.windowStart = now;
      }

      record.count += 1;

      if (record.count > RATE_LIMIT) {
        return new Response("Too Many Requests", { status: 429 });
      }

      await rateStore.set(rateKey, JSON.stringify(record));
    } catch {
    }

    const history = await fetchHistory();
    if (!history) {
      return new Response("Not found", { status: 200 });
    }

    let contentKey: string | null = null;

    if (!provider && !ver) {
      if (history.working) {
        contentKey = `content:${history.working.source}:${history.working.version}`;
      }
    } else if (provider && !ver) {
      const sourceEntries = history.entries.filter(e => e.source === provider && !e.revoked && !e.softbanned);
      let bestVer = 0;
      let bestVerStr = "";
      for (const e of sourceEntries) {
        const v = parseInt(e.version, 10);
        if (!isNaN(v) && v > bestVer) {
          bestVer = v;
          bestVerStr = e.version;
        }
      }
      if (bestVerStr) {
        contentKey = `content:${provider}:${bestVerStr}`;
      }
    } else if (provider && ver) {
      contentKey = `content:${provider}:${ver}`;
    }

    if (!contentKey) {
      return new Response("Not found", { status: 200 });
    }

    const store = getStore("keybox-history");
    const value = await store.get(contentKey);

    if (!value) {
      return new Response("Not found", { status: 200 });
    }

    const metaKey = `meta:${contentKey.slice(8)}`;
    const metaRaw = await store.get(metaKey);
    const meta = metaRaw ? JSON.parse(metaRaw) as { useBase64: boolean } | null : null;
    const raw = meta?.useBase64 ? value : Buffer.from(value).toString("base64");
    const output = raw.replace(/[A-Za-z0-9+/]/g, (c) => RAV_SHFL[RAV_B64.indexOf(c)] ?? c);

    return new Response(output, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return new Response(msg, { status: 200 });
  }
};
