interface Env {
  RAW_BIN: R2Bucket;
  NETLIFY_SITE_URL: string;
}

const ALLOWED_BUCKETS = ["apks", "modules", "files", "clipboards"] as const;
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, GET, DELETE, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-max-age": "86400",
} as const;

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

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

function validateKey(key: string): boolean {
  return !key.includes("..");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const segments = url.pathname.slice(1).split("/");
      const path = segments[0];
      const action = segments[1];

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS });
      }

      if (request.method === "PUT" && path === "upload" && action && ALLOWED_BUCKETS.includes(action as typeof ALLOWED_BUCKETS[number])) {
        return handleUpload(request, env, action);
      }

      if (request.method === "GET" && path === "raw" && action && ALLOWED_BUCKETS.includes(action as typeof ALLOWED_BUCKETS[number])) {
        const key = segments.slice(2).join("/");
        if (!key || !validateKey(key)) return respond("Not found", 404);
        return handleDownload(env, action, key, url);
      }

      if (request.method === "DELETE" && path === "raw" && action && ALLOWED_BUCKETS.includes(action as typeof ALLOWED_BUCKETS[number])) {
        const key = segments.slice(2).join("/");
        if (!key || !validateKey(key)) return respond("Not found", 404);
        return handleDelete(request, env, action, key);
      }

      return respond("Not found", 404);
    } catch (err) {
      return respond("Internal Server Error", 500);
    }
  },
};

async function verifyToken(token: string, env: Env): Promise<boolean> {
  try {
    const baseUrl = env.NETLIFY_SITE_URL;
    if (!baseUrl.startsWith("https://")) return false;
    const res = await fetch(`${baseUrl}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleUpload(request: Request, env: Env, bucket: string): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, env);
  if (!isValid) return respond("Unauthorized", 401);

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_UPLOAD_SIZE) {
    return respond("Payload too large", 413);
  }

  let blob: Blob;
  try {
    blob = await request.blob();
  } catch {
    return respond("Failed to read body", 400);
  }

  if (blob.size === 0) return respond("Empty file", 400);
  if (blob.size > MAX_UPLOAD_SIZE) return respond("Payload too large", 413);

  const blobId = `blob_${crypto.randomUUID()}`;
  const key = `${bucket}/${blobId}`;

  await env.RAW_BIN.put(key, blob, {
    customMetadata: {
      bucket,
      uploadedAt: new Date().toISOString(),
    },
  });

  return json({ id: blobId, size: blob.size, key });
}

async function handleDelete(request: Request, env: Env, bucket: string, key: string): Promise<Response> {
  const token = extractBearer(request);
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, env);
  if (!isValid) return respond("Unauthorized", 401);

  const fullKey = `${bucket}/${key}`;
  await env.RAW_BIN.delete(fullKey);
  return json({ deleted: true });
}

async function handleDownload(env: Env, bucket: string, key: string, url: URL): Promise<Response> {
  const fullKey = `${bucket}/${key}`;
  const object = await env.RAW_BIN.get(fullKey);
  if (!object) return respond("Not found", 404);

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

  const name = url.searchParams.get("name");
  if (name) {
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  }

  return new Response(object.body, { headers });
}
