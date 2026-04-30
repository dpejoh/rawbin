import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOCKED_AGENTS = ["googlebot", "bingbot", "baiduspider", "crawler", "spider", "scraper"];

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const ua = (event.headers["user-agent"] ?? "").toLowerCase();
  if (BLOCKED_AGENTS.some((bot) => ua.includes(bot))) {
    return { statusCode: 403, body: "Forbidden" };
  }

  const ip = event.headers["x-forwarded-for"] ?? event.headers["client-ip"] ?? "unknown";

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
      return { statusCode: 429, body: "Too Many Requests" };
    }

    await rateStore.set(rateKey, JSON.stringify(record), { ttl: RATE_WINDOW_MS / 1000 } as never);
  } catch {
    // rate limiting failure is non-critical
  }

  const store = getStore("keybox");
  const value = await store.get("content");

  if (!value) {
    return { statusCode: 404, body: "Not found" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: value,
  };
};

export { handler };
