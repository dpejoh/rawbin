/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader } from "../lib/auth";
import { applyShuffle } from "../lib/shuffle";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const catalog = new Hono<{ Bindings: Env }>();

// ── Rate limiting for public raw endpoint ─────────────────────

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const row = await env.DB.prepare(
    "SELECT value FROM resolve_config WHERE instance_slug = ?",
  ).bind(key).first<{ value: string }>();
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxReqs = 60;

  if (row) {
    const [count, ts] = row.value.split(":").map(Number);
    if (now - ts < windowMs) {
      if (count >= maxReqs) return false;
      await env.DB.prepare(
        "UPDATE resolve_config SET config = ?, updated_at = datetime('now') WHERE instance_slug = ?",
      ).bind(`${count + 1}:${ts}`, key).run();
    } else {
      await env.DB.prepare(
        "UPDATE resolve_config SET config = ?, updated_at = datetime('now') WHERE instance_slug = ?",
      ).bind(`1:${now}`, key).run();
    }
  } else {
    await env.DB.prepare(
      "INSERT INTO resolve_config (instance_slug, config, updated_at) VALUES (?, ?, datetime('now'))",
    ).bind(key, `1:${now}`).run();
  }
  return true;
}

// ── Public keybox raw endpoint (rate-limited, shuffled) ───────

catalog.get("/raw/key/:source", async (c) => {
  const source = c.req.param("source");
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await checkRateLimit(c.env, ip))) return c.body("Rate limited", 429);

  const instance_slug = c.req.query("instance") ?? "admin";

  // Find the entry with working status or latest for this source
  const entry = await c.env.DB.prepare(
    "SELECT * FROM keybox_history WHERE instance_slug = ? AND source = ? ORDER BY created_at DESC LIMIT 1",
  ).bind(instance_slug, source).first<{
    content: string; version: string; status: string;
  }>();

  if (!entry) return c.body("Not found", 404);

  // Build output with shuffle
  const output = applyShuffle(btoa(entry.content));
  return c.body(output, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-cache",
  });
});

catalog.get("/raw/key/:source/:version", async (c) => {
  const source = c.req.param("source");
  const version = c.req.param("version");
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await checkRateLimit(c.env, ip))) return c.body("Rate limited", 429);

  const instance_slug = c.req.query("instance") ?? "admin";

  const entry = await c.env.DB.prepare(
    "SELECT * FROM keybox_history WHERE instance_slug = ? AND source = ? AND version = ? LIMIT 1",
  ).bind(instance_slug, source, version).first<{ content: string }>();

  if (!entry) return c.body("Not found", 404);

  const output = applyShuffle(btoa(entry.content));
  return c.body(output, 200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-cache",
  });
});

// ── Authenticated CRUD ───────────────────────────────────────

async function requireAdmin(auth: string | null, env: Env): Promise<{ email: string; instance_slug: string } | null> {
  if (!auth) return null;
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, env.DB);
  if (!session || session.role !== "admin") return null;
  return { email: session.email, instance_slug: session.instance_slug };
}

catalog.get("/api/catalog", async (c) => {
  const instance_slug = c.req.query("instance") ?? "admin";

  // Check for specific version query
  const v = c.req.query("v");
  if (v) {
    const [source, version] = v.split(":");
    if (source && version) {
      const entry = await c.env.DB.prepare(
        "SELECT * FROM keybox_history WHERE instance_slug = ? AND source = ? AND version = ? LIMIT 1",
      ).bind(instance_slug, source, version).first<{
        id: string; serial: string; source: string; version: string;
        content: string; status: string; created_at: string; updated_at: string;
      }>();
      if (!entry) return c.json(null);
      return c.json({
        id: entry.id,
        serial: entry.serial,
        source: entry.source,
        version: entry.version,
        text: entry.content,
        content: entry.content,
        status: entry.status,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      });
    }
  }

  // Check for serial query
  const serial = c.req.query("serial");
  if (serial) {
    const entries = await c.env.DB.prepare(
      "SELECT * FROM keybox_history WHERE instance_slug = ? AND serial = ? ORDER BY created_at DESC",
    ).bind(instance_slug, serial).all();
    return c.json(entries.results.map((r: Record<string, unknown>) => ({
      id: r.id, serial: r.serial, source: r.source, version: r.version,
      status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
    })));
  }

  // List all — return with latest, working, autoOverride
  const items = await c.env.DB.prepare(
    "SELECT id, serial, source, version, status, auto_override_source, auto_override_version, content, created_at, updated_at FROM keybox_history WHERE instance_slug = ? ORDER BY created_at DESC",
  ).bind(instance_slug).all();

  const entries = items.results.map((r: Record<string, unknown>) => ({
    id: r.id,
    source: r.source,
    version: r.version,
    serial: r.serial,
    text: r.content,
    timestamp: r.created_at,
    last_checked: r.updated_at,
    revoked: r.status === "revoked",
  }));

  // Build latest per source
  const latest: Record<string, string> = {};
  for (const e of items.results) {
    const src = e.source as string;
    const ver = e.version as string;
    if (!latest[src] || ver > latest[src]) {
      latest[src] = ver;
    }
  }

  // Find working entry (first "active" entry or latest overall)
  const workingEntry = items.results.find((r) => r.status === "active") ?? items.results[0];
  const working = workingEntry ? { source: workingEntry.source, version: workingEntry.version } : null;

  // Find auto-override
  const overrideEntry = items.results.find(
    (r) => r.auto_override_source && r.auto_override_version,
  );
  const autoOverride = overrideEntry
    ? { source: overrideEntry.auto_override_source, version: overrideEntry.auto_override_version }
    : null;

  return c.json({ entries, latest, working, autoOverride });
});

catalog.post("/api/catalog/save", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{
    source?: string; version?: string; content?: string; serial?: string;
  }>();
  if (!body.source || !body.version) return c.json({ error: "Missing source or version" }, 400);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Check for existing entry with same source + version
  const existing = await c.env.DB.prepare(
    "SELECT id FROM keybox_history WHERE instance_slug = ? AND source = ? AND version = ?",
  ).bind(session.instance_slug, body.source, body.version).first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE keybox_history SET content = ?, serial = COALESCE(NULLIF(?, ''), serial), updated_at = ? WHERE id = ?",
    ).bind(body.content ?? "", body.serial ?? "", now, existing.id).run();
    return c.json({ id: existing.id });
  }

  await c.env.DB.prepare(
    "INSERT INTO keybox_history (id, instance_slug, serial, source, version, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, session.instance_slug, body.serial ?? "", body.source, body.version, body.content ?? "", now, now).run();
  return c.json({ id }, 201);
});

catalog.post("/api/catalog/set-status", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ serial?: string; status?: string }>();
  if (!body.serial || !body.status) return c.json({ error: "Missing serial or status" }, 400);

  const result = await c.env.DB.prepare(
    "UPDATE keybox_history SET status = ?, updated_at = ? WHERE instance_slug = ? AND serial = ?",
  ).bind(body.status, new Date().toISOString(), session.instance_slug, body.serial).run();

  return c.json({ updated: result.meta.changes });
});

catalog.post("/api/catalog/set-auto-override", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ source?: string; version?: string }>();
  if (!body.source || !body.version) return c.json({ error: "Missing source or version" }, 400);

  await c.env.DB.prepare(
    "UPDATE keybox_history SET auto_override_source = ?, auto_override_version = ?, updated_at = ? WHERE instance_slug = ? AND source = ? AND version = ?",
  ).bind(body.source, body.version, new Date().toISOString(), session.instance_slug, body.source, body.version).run();

  return c.json({ ok: true });
});

catalog.post("/api/catalog/clear-auto-override", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ source?: string; version?: string }>();
  if (!body.source || !body.version) return c.json({ error: "Missing source or version" }, 400);

  await c.env.DB.prepare(
    "UPDATE keybox_history SET auto_override_source = '', auto_override_version = '', updated_at = ? WHERE instance_slug = ? AND source = ? AND version = ?",
  ).bind(new Date().toISOString(), session.instance_slug, body.source, body.version).run();

  return c.json({ ok: true });
});

catalog.post("/api/catalog", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ entries?: Array<{ source: string; version: string; content: string; serial?: string }> }>();
  if (!body.entries) return c.json({ error: "Invalid body" }, 400);

  const now = new Date().toISOString();
  const stmts = body.entries.map((entry) =>
    c.env.DB.prepare(
      "INSERT OR IGNORE INTO keybox_history (id, instance_slug, serial, source, version, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), session.instance_slug, entry.serial ?? "", entry.source, entry.version, entry.content, now, now)
  );
  await c.env.DB.batch(stmts);
  return c.json({ imported: body.entries.length });
});

catalog.delete("/api/catalog", async (c) => {
  const session = await requireAdmin(parseAuthHeader(c.req.header("Authorization")), c.env);
  if (!session) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ id?: string }>();
  if (!body.id) return c.json({ error: "Invalid body" }, 400);

  const result = await c.env.DB.prepare(
    "DELETE FROM keybox_history WHERE id = ? AND instance_slug = ?",
  ).bind(body.id, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default catalog;
