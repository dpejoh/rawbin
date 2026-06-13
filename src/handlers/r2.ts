/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const ALLOWED_BUCKETS = ["apks", "modules", "files", "clipboards"];
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, GET, DELETE, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-max-age": "86400",
} as const;

const r2 = new Hono<{ Bindings: Env }>();

async function verifyToken(token: string, env: Env): Promise<boolean> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(token, secret, env.DB);
  return session !== null;
}

function validateKey(key: string): boolean {
  return !key.includes("..");
}

function respond(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { ...CORS, "content-type": "text/plain" },
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// ── Upload ─────────────────────────────────────────────────────

r2.post("/upload/:bucket", async (c) => {
  const bucket = c.req.param("bucket");
  if (!ALLOWED_BUCKETS.includes(bucket)) return c.body("Not found", 404);

  const url = new URL(c.req.url);
  let token = parseAuthHeader(c.req.header("Authorization"));
  if (!token) token = url.searchParams.get("token");
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, c.env);
  if (!isValid) return respond("Unauthorized", 401);

  let blob: Blob;
  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") return respond("Missing file", 400);
    blob = file as Blob;
  } catch {
    return respond("Failed to parse form", 400);
  }

  if (blob.size === 0) return respond("Empty file", 400);
  if (blob.size > MAX_UPLOAD_SIZE) return respond("Payload too large", 413);

  const customKey = url.searchParams.get("key");
  const finalId = customKey ?? `blob_${crypto.randomUUID()}`;

  if (customKey && !/^[a-zA-Z0-9._\-\u0080-\uFFFF]+$/.test(customKey)) {
    return respond("Invalid key", 400);
  }

  const key = `${bucket}/${finalId}`;

  await c.env.RAW_BIN.put(key, blob, {
    customMetadata: {
      bucket,
      uploadedAt: new Date().toISOString(),
    },
  });

  return json({ id: finalId, size: blob.size, key });
});

r2.put("/upload/:bucket", async (c) => {
  const bucket = c.req.param("bucket");
  if (!ALLOWED_BUCKETS.includes(bucket)) return c.body("Not found", 404);

  const url = new URL(c.req.url);
  const token = parseAuthHeader(c.req.header("Authorization"));
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, c.env);
  if (!isValid) return respond("Unauthorized", 401);

  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_UPLOAD_SIZE) {
    return respond("Payload too large", 413);
  }

  let blob: Blob;
  try {
    blob = await c.req.blob();
  } catch {
    return respond("Failed to read body", 400);
  }

  if (blob.size === 0) return respond("Empty file", 400);
  if (blob.size > MAX_UPLOAD_SIZE) return respond("Payload too large", 413);

  const customKey = url.searchParams.get("key");
  const finalId = customKey ?? `blob_${crypto.randomUUID()}`;

  if (customKey && !/^[a-zA-Z0-9._\-\u0080-\uFFFF]+$/.test(customKey)) {
    return respond("Invalid key", 400);
  }

  const key = `${bucket}/${finalId}`;

  await c.env.RAW_BIN.put(key, blob, {
    customMetadata: {
      bucket,
      uploadedAt: new Date().toISOString(),
    },
  });

  return json({ id: finalId, size: blob.size, key });
});

// ── Download ──────────────────────────────────────────────────

r2.get("/raw/:bucket/:key+", async (c) => {
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  if (!ALLOWED_BUCKETS.includes(bucket) || !key || !validateKey(key)) {
    return c.body("Not found", 404);
  }

  const fullKey = `${bucket}/${key}`;
  const object = await c.env.RAW_BIN.get(fullKey);
  if (!object) return c.body("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");

  const contentType = bucket === "apks"
    ? "application/vnd.android.package-archive"
    : bucket === "modules"
    ? "application/zip"
    : object.httpMetadata?.contentType ?? "application/octet-stream";

  headers.set("content-type", contentType);

  const fileName = key.split("/").pop() || key;
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

  return new Response(object.body, { headers });
});

// ── Delete ────────────────────────────────────────────────────

r2.delete("/raw/:bucket/:key+", async (c) => {
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  if (!ALLOWED_BUCKETS.includes(bucket) || !key || !validateKey(key)) {
    return c.body("Not found", 404);
  }

  const token = parseAuthHeader(c.req.header("Authorization"));
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, c.env);
  if (!isValid) return respond("Unauthorized", 401);

  const fullKey = `${bucket}/${key}`;
  await c.env.RAW_BIN.delete(fullKey);
  return json({ deleted: true });
});

r2.options("/upload/:bucket", (c) => {
  return new Response(null, { headers: CORS });
});

r2.options("/raw/:bucket/:key+", (c) => {
  return new Response(null, { headers: CORS });
});

export default r2;
