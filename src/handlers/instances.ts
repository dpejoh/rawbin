/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader, getAppDomain } from "../lib/auth";
import { sendEmail } from "../lib/email";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
}

const instances = new Hono<{ Bindings: Env }>();

instances.get("/api/instances", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const rows = await c.env.DB.prepare(`
    SELECT
      i.slug,
      i.owner_email,
      i.display_name,
      i.created_at,
      (SELECT COUNT(*) FROM users WHERE instance_slug = i.slug) as user_count,
      (SELECT password_hash != '' FROM users WHERE instance_slug = i.slug AND role = 'admin' LIMIT 1) as setup_complete
    FROM instances i
    ORDER BY i.created_at DESC
  `).all();

  const list = (rows.results || []).map((r) => {
    const row = r as {
      slug: string;
      owner_email: string;
      display_name: string;
      created_at: string;
      user_count: number;
      setup_complete: number;
    };
    return {
      slug: row.slug,
      owner_email: row.owner_email,
      display_name: row.display_name,
      created_at: row.created_at,
      user_count: row.user_count,
      setup_complete: row.setup_complete === 1,
    };
  });

  return c.json({ instances: list });
});

instances.delete("/api/instances/:slug", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const slug = c.req.param("slug");
  if (slug === "admin") return c.json({ error: "Cannot delete main instance" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT slug FROM instances WHERE slug = ?",
  ).bind(slug).first();
  if (!existing) return c.json({ error: "Instance not found" }, 404);

  await c.env.DB.prepare("DELETE FROM instances WHERE slug = ?").bind(slug).run();
  return c.json({ deleted: true });
});

instances.post("/api/instances/:slug/resend", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const slug = c.req.param("slug");
  const adminUser = await c.env.DB.prepare(
    "SELECT email, password_hash FROM users WHERE instance_slug = ? AND role = 'admin' LIMIT 1",
  ).bind(slug).first<{ email: string; password_hash: string }>();
  if (!adminUser) return c.json({ error: "Instance not found" }, 404);
  if (adminUser.password_hash) return c.json({ error: "Password already set" }, 400);

  // Invalidate old tokens, create new one
  await c.env.DB.prepare(
    "DELETE FROM invite_tokens WHERE email = ? AND instance_slug = ? AND type = 'setup'",
  ).bind(adminUser.email, slug).run();

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO invite_tokens (id, email, instance_slug, token, type, expires_at) VALUES (?, ?, ?, ?, 'setup', ?)",
  ).bind(crypto.randomUUID(), adminUser.email, slug, token, expiresAt).run();

  const host = getAppDomain(c.req.raw);
  const setupUrl = `https://${slug}.${host}?token=${token}`;
  await sendEmail({
    to: adminUser.email,
    subject: "Set up your rawbin account",
    html: `<p>Hi,</p><p>Your rawbin instance <strong>${slug}.${host}</strong> is ready.</p><p>Click the link below to set your password and activate your account:</p><p><a href="${setupUrl}">${setupUrl}</a></p><p>This link expires in 48 hours.</p>`,
    text: `Hi,\n\nYour rawbin instance ${slug}.${host} is ready.\n\nClick this link to set your password:\n${setupUrl}\n\nThis link expires in 48 hours.`,
    env: c.env,
  });

  return c.json({ ok: true });
});

export default instances;
