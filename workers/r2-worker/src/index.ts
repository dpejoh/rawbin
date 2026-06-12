interface Env {
  RAW_BIN: R2Bucket;
  NETLIFY_SITE_URL: string;
}

const ALLOWED_BUCKETS = ["apks", "modules", "files", "clipboards"] as const;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PUT, POST, GET, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-max-age": "86400",
  "vary": "origin",
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const [path, action] = url.pathname.slice(1).split("/");

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: CORS });
      }

      // ── Upload: PUT /upload/:bucket ────────────────────────────────
      if (request.method === "PUT" && path === "upload" && action && ALLOWED_BUCKETS.includes(action as typeof ALLOWED_BUCKETS[number])) {
        return handleUpload(request, env, action);
      }

      // ── Raw download: GET /raw/:bucket/:key ─────────────────────────
      if (request.method === "GET" && path === "raw" && action) {
        const key = url.pathname.slice(`/raw/${action}/`.length);
        if (!key) return respond("Not found", 404);
        return handleDownload(env, action, key);
      }

      // ── Delete: DELETE /raw/:bucket/:key ────────────────────────────
      if (request.method === "DELETE" && path === "raw" && action) {
        const key = url.pathname.slice(`/raw/${action}/`.length);
        if (!key) return respond("Not found", 404);
        return handleDelete(request, env, action, key);
      }

      return respond("Not found", 404);
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      return respond(msg, 500);
    }
  },
};

async function verifyToken(token: string, env: Env): Promise<boolean> {
  try {
    const res = await fetch(`${env.NETLIFY_SITE_URL}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleUpload(request: Request, env: Env, bucket: string): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return respond("Unauthorized", 401);

  const isValid = await verifyToken(token, env);
  if (!isValid) return respond("Unauthorized", 401);

  const blobId = `blob_${crypto.randomUUID()}`;
  const key = `${bucket}/${blobId}`;

  const contentLength = request.headers.get("content-length");
  const size = contentLength ? parseInt(contentLength, 10) : null;

  // Validate ZIP magic bytes
  const blob = await request.blob();
  if (blob.size === 0) {
    return respond("Empty file", 400);
  }
  const header = await blob.slice(0, 4).arrayBuffer();
  const magic = new Uint8Array(header);
  if (magic[0] !== 0x50 || magic[1] !== 0x4B || magic[2] !== 0x03 || magic[3] !== 0x04) {
    return respond("Not a valid ZIP file", 400);
  }

  await env.RAW_BIN.put(key, blob, {
    customMetadata: {
      bucket,
      uploadedAt: new Date().toISOString(),
    },
  });

  return json({ id: blobId, size: blob.size, key });
}

async function handleDelete(request: Request, env: Env, bucket: string, key: string): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return respond("Unauthorized", 401);
  const isValid = await verifyToken(token, env);
  if (!isValid) return respond("Unauthorized", 401);

  const fullKey = `${bucket}/${key}`;
  await env.RAW_BIN.delete(fullKey);
  return respond("Deleted", 200);
}

async function handleDownload(env: Env, bucket: string, key: string): Promise<Response> {
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

  return new Response(object.body, { headers });
}
