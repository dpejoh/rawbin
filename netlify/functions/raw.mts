import { getStore } from "@netlify/blobs";

const BLOCKED_AGENTS = ["googlebot", "bingbot", "baiduspider", "crawler", "spider", "scraper"];
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export default async (req: Request) => {
  const url = new URL(req.url);
  const isMeta = url.searchParams.has("meta");

  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  if (BLOCKED_AGENTS.some((bot) => ua.includes(bot))) {
    return new Response("Forbidden", { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("client-ip") ?? "unknown";

  try {
    const rateStore = getStore("keybox-rate-limit");
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
    // rate limiting failure is non-critical
  }

  const store = getStore("keybox");

  if (isMeta) {
    const meta = await store.get("_meta");
    if (!meta) {
      return new Response(JSON.stringify({ useBase64: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(meta, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const value = await store.get("content");

  if (!value) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(value, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};
