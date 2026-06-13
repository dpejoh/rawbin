/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { verifyJWT, parseAuthHeader, getAppDomain, ROLES } from "../lib/auth";
import { sendEmail } from "../lib/email";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
}

const roles = new Hono<{ Bindings: Env }>();

roles.get("/api/roles", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const allUsers = await c.env.DB.prepare(
    "SELECT email, role FROM users WHERE instance_slug = ? ORDER BY email",
  ).bind(session.instance_slug).all();

  const result: Record<string, unknown> = { email: session.email, role: session.role };
  if (session.role === "admin") {
    const rolesMap: Record<string, string> = {};
    for (const u of allUsers.results) {
      const user = u as { email: string; role: string };
      rolesMap[user.email] = user.role;
    }
    result.roles = rolesMap;
  }
  return c.json(result);
});

roles.post("/api/roles", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ email?: string; role?: string }>();
  if (!body.email || !body.role) return c.json({ error: "Missing email or role" }, 400);

  if (!ROLES.includes(body.role as typeof ROLES[number])) return c.json({ error: "Invalid role" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT email FROM users WHERE email = ? AND instance_slug = ?",
  ).bind(body.email, session.instance_slug).first();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE users SET role = ? WHERE email = ? AND instance_slug = ?",
    ).bind(body.role, body.email, session.instance_slug).run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, role, instance_slug) VALUES (?, '', ?, ?)",
    ).bind(body.email, body.role, session.instance_slug).run();

    // Send invite email with setup link
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      "INSERT INTO invite_tokens (id, email, instance_slug, token, type, expires_at) VALUES (?, ?, ?, ?, 'invite', ?)",
    ).bind(crypto.randomUUID(), body.email, session.instance_slug, token, expiresAt).run();

    const host = getAppDomain(c.req.raw);
    const setupUrl = `https://${session.instance_slug}.${host}?token=${token}`;
    await sendEmail({
      to: body.email,
      subject: "You've been invited to rawbin",
      html: `<p>Hi,</p><p>You've been invited to <strong>${session.instance_slug}.rawbin.dpejoh.com</strong> as a <strong>${body.role}</strong>.</p><p>Click the link below to set your password and get started:</p><p><a href="${setupUrl}">${setupUrl}</a></p><p>This link expires in 48 hours.</p>`,
      text: `Hi,\n\nYou've been invited to ${session.instance_slug}.rawbin.dpejoh.com as a ${body.role}.\n\nClick this link to set your password:\n${setupUrl}\n\nThis link expires in 48 hours.`,
      env: c.env,
    });
  }

  return c.json({ email: body.email, role: body.role });
});

roles.delete("/api/roles", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ email?: string }>();
  if (!body.email) return c.json({ error: "Missing email" }, 400);

  const result = await c.env.DB.prepare(
    "DELETE FROM users WHERE email = ? AND instance_slug = ?",
  ).bind(body.email, session.instance_slug).run();

  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ deleted: true });
});

export default roles;
