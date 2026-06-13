/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const apps = new Hono<{ Bindings: Env }>();

apps.get("/api/apps", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const q = c.req.query("q");
  let items;
  if (q) {
    items = await c.env.DB.prepare(
      "SELECT * FROM app_catalog WHERE instance_slug = ? AND (package_name LIKE ? OR app_name LIKE ?) ORDER BY app_name",
    ).bind(session.instance_slug, `%${q}%`, `%${q}%`).all();
  } else {
    items = await c.env.DB.prepare(
      "SELECT * FROM app_catalog WHERE instance_slug = ? ORDER BY app_name",
    ).bind(session.instance_slug).all();
  }

  return c.json(items.results.map((r: Record<string, unknown>) => ({
    id: r.id,
    packageName: r.package_name,
    appName: r.app_name,
    createdAt: r.created_at,
  })));
});

apps.post("/api/apps/save", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ packageName?: string; appName?: string }>();
  if (!body.packageName || !body.appName) return c.json({ error: "Missing fields" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM app_catalog WHERE package_name = ? AND instance_slug = ?",
  ).bind(body.packageName, session.instance_slug).first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE app_catalog SET app_name = ? WHERE id = ?",
    ).bind(body.appName, existing.id).run();
    return c.json({ id: existing.id });
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO app_catalog (id, instance_slug, package_name, app_name, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, session.instance_slug, body.packageName, body.appName, new Date().toISOString()).run();
  return c.json({ id }, 201);
});

apps.post("/api/apps", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ entries?: Array<{ packageName: string; appName: string }> }>();
  if (!body.entries || !Array.isArray(body.entries)) return c.json({ error: "Invalid body" }, 400);

  const now = new Date().toISOString();
  const stmts = body.entries.map((entry) =>
    c.env.DB.prepare(
      "INSERT OR IGNORE INTO app_catalog (id, instance_slug, package_name, app_name, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), session.instance_slug, entry.packageName, entry.appName, now)
  );
  await c.env.DB.batch(stmts);
  return c.json({ imported: body.entries.length });
});

apps.delete("/api/apps", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ ids?: string[] }>();
  if (!body.ids || !Array.isArray(body.ids)) return c.json({ error: "Invalid body" }, 400);

  const stmts = body.ids.map((id) =>
    c.env.DB.prepare("DELETE FROM app_catalog WHERE id = ? AND instance_slug = ?").bind(id, session.instance_slug)
  );
  await c.env.DB.batch(stmts);
  return c.json({ deleted: body.ids.length });
});

export default apps;
