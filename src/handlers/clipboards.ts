/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { applyShuffle } from "../lib/shuffle";
import { resolveRefs } from "../lib/resolveRefs";
import { getInstanceSlug, verifyJWT, parseAuthHeader } from "../lib/auth";
import type { SessionPayload } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const R2_WORKER = "https://rawbin.dpejoh.com";

function isValidSlug(s: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(s);
}

const clipboards = new Hono<{ Bindings: Env }>();

// ── Public raw clipboards ──────────────────────────────────────

// Public raw clipboards — mounted at /clips/:slug to avoid routing conflicts with R2 /raw/:bucket/:key+

clipboards.get("/clips/:slug", async (c) => {
  const slug = c.req.param("slug");
  const instance_slug = getInstanceSlug(c.req.raw, new URL(c.req.url));

  const item = await c.env.DB.prepare(
    "SELECT * FROM clipboards WHERE (id = ? OR slug = ?) AND instance_slug = ?",
  ).bind(slug, slug, instance_slug).first<{
    id: string;
    name: string;
    content: string;
    use_base64: number;
    use_shuffle: number;
  }>();

  if (!item) return c.body("Not found", 404);

  let output: string;

  try {
    const decoded = item.use_base64 ? atob(item.content) : item.content;
    const resolved = await resolveRefs(decoded, c.env.DB, R2_WORKER);
    if (resolved !== null) {
      const reEncoded = item.use_base64 ? btoa(resolved) : resolved;
      output = item.use_shuffle ? applyShuffle(reEncoded) : reEncoded;
    } else {
      output = item.use_shuffle ? applyShuffle(item.content) : item.content;
    }
  } catch {
    output = item.use_shuffle ? applyShuffle(item.content) : item.content;
  }

  return c.body(output, 200, { "Content-Type": "text/plain" });
});

// ── Authenticated CRUD ─────────────────────────────────────────

async function requireRole(
  session: SessionPayload | null,
  minRole: string,
): Promise<boolean> {
  if (!session) return false;
  const hierarchy: Record<string, number> = { viewer: 0, yuri: 0, editor: 1, admin: 2 };
  return (hierarchy[session.role] ?? 0) >= (hierarchy[minRole] ?? 0);
}

clipboards.get("/api/clipboards", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const items = await c.env.DB.prepare(
    "SELECT * FROM clipboards WHERE instance_slug = ? ORDER BY updated_at DESC",
  ).bind(session.instance_slug).all<{
    id: string;
    name: string;
    slug: string | null;
    content: string;
    use_base64: number;
    use_shuffle: number;
    created_at: string;
    updated_at: string;
  }>();

  const result = items.results.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    content: item.content,
    useBase64: item.use_base64 === 1,
    useShuffle: item.use_shuffle === 1,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));

  return c.json(result);
});

clipboards.post("/api/clipboards", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || !(await requireRole(session, "admin"))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    slug?: string;
    useBase64?: boolean;
    useShuffle?: boolean;
  }>();

  if (!body.name?.trim()) return c.json({ error: "Name is required" }, 400);

  const trimmedName = body.name.trim();
  const trimmedSlug = body.slug?.trim();

  if (trimmedSlug) {
    if (!isValidSlug(trimmedSlug)) {
      return c.json({ error: "Slug must be alphanumeric (hyphens and underscores allowed)" }, 400);
    }
    const existing = await c.env.DB.prepare(
      "SELECT id FROM clipboards WHERE slug = ? AND instance_slug = ?",
    ).bind(trimmedSlug, session.instance_slug).first();
    if (existing) return c.json({ error: "Slug already in use" }, 409);
  }

  const clipId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO clipboards (id, instance_slug, name, slug, content, use_base64, use_shuffle, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)",
  ).bind(
    clipId,
    session.instance_slug,
    trimmedName,
    trimmedSlug ?? null,
    body.useBase64 !== false ? 1 : 0,
    body.useShuffle === true ? 1 : 0,
    now,
    now,
  ).run();

  return c.json({ id: clipId, slug: trimmedSlug || undefined }, 201);
});

clipboards.put("/api/clipboards", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{
    id?: string;
    name?: string;
    content?: string;
    slug?: string;
    useBase64?: boolean;
    useShuffle?: boolean;
  }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  const item = await c.env.DB.prepare(
    "SELECT * FROM clipboards WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).first<{
    id: string;
    name: string;
    slug: string | null;
    use_base64: number;
    use_shuffle: number;
  }>();

  if (!item) return c.json({ error: "Not found" }, 404);

  const isYuriEditor = session.role === "yuri" && item.slug === "yuri";

  if (isYuriEditor) {
    if (body.content !== undefined) {
      const stored = item.use_base64 ? btoa(body.content) : body.content;
      await c.env.DB.prepare(
        "UPDATE clipboards SET content = ?, updated_at = ? WHERE id = ?",
      ).bind(stored, new Date().toISOString(), item.id).run();
    }
    return c.json({ updated: true });
  }

  if (!(await requireRole(session, "admin"))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.name !== undefined) {
    updates.push("name = ?");
    values.push(body.name.trim());
  }

  if (body.slug !== undefined) {
    const trimmedSlug = body.slug.trim();
    if (trimmedSlug) {
      if (!isValidSlug(trimmedSlug)) {
        return c.json({ error: "Slug must be alphanumeric" }, 400);
      }
      const dup = await c.env.DB.prepare(
        "SELECT id FROM clipboards WHERE slug = ? AND instance_slug = ? AND id != ?",
      ).bind(trimmedSlug, session.instance_slug, item.id).first();
      if (dup) return c.json({ error: "Slug already in use" }, 409);
      updates.push("slug = ?");
      values.push(trimmedSlug);
    } else {
      updates.push("slug = NULL");
    }
  }

  if (body.useBase64 !== undefined) {
    updates.push("use_base64 = ?");
    values.push(body.useBase64 ? 1 : 0);
  }

  if (body.useShuffle !== undefined) {
    updates.push("use_shuffle = ?");
    values.push(body.useShuffle ? 1 : 0);
  }

  if (body.content !== undefined) {
    const currentBase64 = body.useBase64 ?? item.use_base64 === 1;
    const stored = currentBase64 ? btoa(body.content) : body.content;
    updates.push("content = ?");
    values.push(stored);
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    values.push(now);
    values.push(item.id);
    await c.env.DB.prepare(
      `UPDATE clipboards SET ${updates.join(", ")} WHERE id = ?`,
    ).bind(...values).run();
  }

  return c.json({ updated: true });
});

clipboards.delete("/api/clipboards", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || !(await requireRole(session, "admin"))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ id?: string }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  const result = await c.env.DB.prepare(
    "DELETE FROM clipboards WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default clipboards;
