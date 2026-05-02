import { getStore } from "@netlify/blobs";

const BLOCKED_AGENTS = ["googlebot", "bingbot", "baiduspider", "crawler", "spider", "scraper"];
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const isMeta = url.searchParams.has("meta");

  const segments = path.split("/").filter(Boolean);
  const lastSegment = segments.length >= 2 ? segments[segments.length - 1] : null;
  const version = lastSegment && lastSegment !== "key" && !lastSegment.includes(".")
    ? lastSegment
    : null;

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
  }

  if (version) {
    try {
      const historyRes = await fetch(`${SITE_URL}/.netlify/functions/history?v=${encodeURIComponent(version)}`);
      if (historyRes.ok) {
        const content = await historyRes.text();
        return new Response(content, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
    } catch {
    }
    return new Response("Not found", { status: 404 });
  }

  const store = getStore("keybox");

  if (isMeta) {
    const meta = await store.get("_meta");
    if (!meta) {
      return new Response(JSON.stringify({ useBase64: true, version: "" }), {
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
