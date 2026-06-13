/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const apks = new Hono<{ Bindings: Env }>();

async function requireAdmin(auth: string | null, env: Env): Promise<{ email: string; instance_slug: string } | null> {
  if (!auth) return null;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, env.DB);
  if (!session || session.role !== "admin") return null;
  return { email: session.email, instance_slug: session.instance_slug };
}

async function requireEditor(auth: string | null, env: Env): Promise<{ email: string; instance_slug: string } | null> {
  if (!auth) return null;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, env.DB);
  if (!session || (session.role !== "editor" && session.role !== "admin")) return null;
  return { email: session.email, instance_slug: session.instance_slug };
}

apks.get("/api/apks", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const items = await c.env.DB.prepare(
    "SELECT * FROM apks WHERE instance_slug = ? ORDER BY updated_at DESC",
  ).bind(session.instance_slug).all();

  return c.json(items.results.map((r: Record<string, unknown>) => ({
    id: r.id,
    packageName: r.package_name,
    appName: r.app_name,
    versionCode: r.version_code,
    versionName: r.version_name,
    minSdk: r.min_sdk,
    targetSdk: r.target_sdk,
    size: r.size,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

apks.post("/api/apks", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{
    blobId?: string;
    size?: number;
    packageName?: string;
    appName?: string;
    versionCode?: number;
    versionName?: string;
    minSdk?: number;
    targetSdk?: number;
  }>();

  if (!body.packageName) return c.json({ error: "packageName required" }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const storageKey = body.blobId ?? "";

  // Upsert: check if package already exists
  const existing = await c.env.DB.prepare(
    "SELECT id, app_name FROM apks WHERE package_name = ? AND instance_slug = ?",
  ).bind(body.packageName, session.instance_slug).first<{ id: string; app_name: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE apks SET app_name = COALESCE(NULLIF(?, ''), app_name), version_code = ?, version_name = ?, min_sdk = ?, target_sdk = ?, size = ?, storage_key = ?, updated_at = ? WHERE id = ?",
    ).bind(
      body.appName ?? null,
      body.versionCode ?? 0,
      body.versionName ?? "",
      body.minSdk ?? 0,
      body.targetSdk ?? 0,
      body.size ?? 0,
      storageKey,
      now,
      existing.id,
    ).run();
    return c.json({ id: existing.id });
  }

  await c.env.DB.prepare(
    "INSERT INTO apks (id, instance_slug, package_name, app_name, version_code, version_name, min_sdk, target_sdk, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    id,
    session.instance_slug,
    body.packageName,
    body.appName ?? "",
    body.versionCode ?? 0,
    body.versionName ?? "",
    body.minSdk ?? 0,
    body.targetSdk ?? 0,
    body.size ?? 0,
    storageKey,
    now,
    now,
  ).run();

  return c.json({ id }, 201);
});

apks.delete("/api/apks", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ id?: string }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  // Get storage key to also delete from R2
  const apk = await c.env.DB.prepare(
    "SELECT storage_key FROM apks WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).first<{ storage_key: string }>();

  if (apk?.storage_key) {
    try {
      await c.env.RAW_BIN.delete(`apks/${apk.storage_key}`);
    } catch { /* file may not exist */ }
  }

  const result = await c.env.DB.prepare(
    "DELETE FROM apks WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default apks;
