/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const files = new Hono<{ Bindings: Env }>();

async function requireEditor(auth: string | null, env: Env): Promise<{ email: string; instance_slug: string } | null> {
  if (!auth) return null;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, env.DB);
  if (!session || (session.role !== "editor" && session.role !== "admin")) return null;
  return { email: session.email, instance_slug: session.instance_slug };
}

files.get("/api/files", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const parentId = c.req.query("parentId") ?? "";
  let items;
  if (parentId) {
    items = await c.env.DB.prepare(
      "SELECT * FROM files WHERE instance_slug = ? AND parent_id = ? ORDER BY is_folder DESC, name",
    ).bind(session.instance_slug, parentId).all();
  } else {
    items = await c.env.DB.prepare(
      "SELECT * FROM files WHERE instance_slug = ? ORDER BY is_folder DESC, name",
    ).bind(session.instance_slug).all();
  }

  return c.json(items.results.map((r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    mimeType: r.mime_type,
    size: r.size,
    parentId: r.parent_id,
    isFolder: r.is_folder === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

files.post("/api/files", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const isFolder = c.req.query("folder") === "1";

  if (isFolder) {
    const body = await c.req.json<{ name?: string; parentId?: string }>();
    if (!body.name) return c.json({ error: "Name required" }, 400);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO files (id, instance_slug, name, mime_type, size, parent_id, is_folder, created_at, updated_at) VALUES (?, ?, ?, '', 0, ?, 1, ?, ?)",
    ).bind(id, session.instance_slug, body.name, body.parentId ?? "", now, now).run();
    return c.json({ id }, 201);
  }

  const body = await c.req.json<{ name?: string; blobId?: string; size?: number; mimeType?: string; parentId?: string }>();
  if (!body.name || !body.blobId) return c.json({ error: "Name and blobId required" }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO files (id, instance_slug, name, mime_type, size, parent_id, is_folder, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
  ).bind(
    id, session.instance_slug, body.name, body.mimeType ?? "",
    body.size ?? 0, body.parentId ?? "", body.blobId, now, now,
  ).run();
  return c.json({ id }, 201);
});

files.delete("/api/files", async (c) => {
  const session = await requireEditor(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ id?: string }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  // Get storage key and children for recursive delete
  const file = await c.env.DB.prepare(
    "SELECT storage_key FROM files WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).first<{ storage_key: string }>();

  if (file?.storage_key) {
    try {
      await c.env.RAW_BIN.delete(`files/${file.storage_key}`);
    } catch { /* may not exist */ }
  }

  // Delete children (recursive)
  const children = await c.env.DB.prepare(
    "SELECT id, storage_key FROM files WHERE parent_id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).all<{ id: string; storage_key: string }>();
  for (const child of children.results) {
    if (child.storage_key) {
      try { await c.env.RAW_BIN.delete(`files/${child.storage_key}`); } catch { /* ignore */ }
    }
    await c.env.DB.prepare("DELETE FROM files WHERE id = ?").bind(child.id).run();
  }

  const result = await c.env.DB.prepare(
    "DELETE FROM files WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default files;
