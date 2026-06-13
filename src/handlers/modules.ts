/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const modules = new Hono<{ Bindings: Env }>();

async function requireEditor(auth: string | null, env: Env): Promise<{ email: string; instance_slug: string } | null> {
  if (!auth) return null;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, env.DB);
  if (!session || (session.role !== "editor" && session.role !== "admin")) return null;
  return { email: session.email, instance_slug: session.instance_slug };
}

modules.get("/api/modules", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const items = await c.env.DB.prepare(
    "SELECT * FROM modules WHERE instance_slug = ? ORDER BY updated_at DESC",
  ).bind(session.instance_slug).all();

  return c.json(items.results.map((r: Record<string, unknown>) => ({
    id: r.id,
    moduleId: r.module_id,
    name: r.name,
    version: r.version,
    versionCode: r.version_code,
    author: r.author,
    description: r.description,
    size: r.size,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

modules.post("/api/modules", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{
    blobId?: string;
    size?: number;
    moduleId?: string;
    name?: string;
    version?: string;
    versionCode?: number;
    author?: string;
    description?: string;
  }>();

  if (!body.moduleId) return c.json({ error: "moduleId required" }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const storageKey = body.blobId ?? "";

  // Upsert
  const existing = await c.env.DB.prepare(
    "SELECT id FROM modules WHERE module_id = ? AND instance_slug = ?",
  ).bind(body.moduleId, session.instance_slug).first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE modules SET name = COALESCE(NULLIF(?, ''), name), version = ?, version_code = ?, author = COALESCE(NULLIF(?, ''), author), description = COALESCE(NULLIF(?, ''), description), size = ?, storage_key = ?, updated_at = ? WHERE id = ?",
    ).bind(
      body.name ?? null,
      body.version ?? "",
      body.versionCode ?? 0,
      body.author ?? null,
      body.description ?? null,
      body.size ?? 0,
      storageKey,
      now,
      existing.id,
    ).run();
    return c.json({ id: existing.id });
  }

  await c.env.DB.prepare(
    "INSERT INTO modules (id, instance_slug, module_id, name, version, version_code, author, description, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    id,
    session.instance_slug,
    body.moduleId,
    body.name ?? "",
    body.version ?? "",
    body.versionCode ?? 0,
    body.author ?? "",
    body.description ?? "",
    body.size ?? 0,
    storageKey,
    now,
    now,
  ).run();

  return c.json({ id }, 201);
});

modules.delete("/api/modules", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ id?: string }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  const mod = await c.env.DB.prepare(
    "SELECT storage_key FROM modules WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).first<{ storage_key: string }>();

  if (mod?.storage_key) {
    try {
      await c.env.RAW_BIN.delete(`modules/${mod.storage_key}`);
    } catch { /* file may not exist */ }
  }

  const result = await c.env.DB.prepare(
    "DELETE FROM modules WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default modules;
