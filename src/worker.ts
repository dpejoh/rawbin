/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { cors } from "hono/cors";
import { SignJWT, jwtVerify } from "jose";
import { verifyJWT, parseAuthHeader } from "./lib/auth";
import { sendEmail } from "./lib/email";
import clipboards from "./handlers/clipboards";
import r2 from "./handlers/r2";
import apks from "./handlers/apks";
import modules from "./handlers/modules";
import files from "./handlers/files";
import apps from "./handlers/apps";
import roles from "./handlers/roles";
import catalog from "./handlers/catalog";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
}

const app = new Hono<{ Bindings: Env }>();

// ── HTTPS redirect ──────────────────────────────────────────

app.use("*", async (c, next) => {
  const proto = c.req.header("x-forwarded-proto");
  if (proto === "http") {
    const url = new URL(c.req.url);
    url.protocol = "https:";
    return c.redirect(url.toString(), 301);
  }
  await next();
});

// ── CORS ──────────────────────────────────────────────────────

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ── Auth helpers ──────────────────────────────────────────────

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    } as Pbkdf2Params,
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPassword(password, salt)) === hash;
}

// ── Auth routes ──────────────────────────────────────────────

app.post("/api/auth/register", async (c) => {
  const auth = parseAuthHeader(c.req.header("Authorization"));
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(auth, secret, c.env.DB);
  if (!session || session.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{ email?: string; instance_slug?: string }>();
  const email = body.email ?? "";
  const instance_slug = body.instance_slug ?? "";
  if (!email || !instance_slug) {
    return c.json({ error: "Missing fields" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT slug FROM instances WHERE slug = ?",
  ).bind(instance_slug).first();
  if (existing) return c.json({ error: "Instance already exists" }, 409);

  // Create instance + user with empty password_hash
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO instances (slug, owner_email) VALUES (?, ?)",
    ).bind(instance_slug, email),
    c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, role, instance_slug) VALUES (?, '', 'admin', ?)",
    ).bind(email, instance_slug),
  ]);

  // Generate setup token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO invite_tokens (id, email, instance_slug, token, type, expires_at) VALUES (?, ?, ?, ?, 'setup', ?)",
  ).bind(crypto.randomUUID(), email, instance_slug, token, expiresAt).run();

  // Send email
  const setupUrl = `https://${instance_slug}.rawbin.dpejoh.com?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Set up your rawbin account",
    html: `<p>Hi,</p><p>Your rawbin instance <strong>${instance_slug}.rawbin.dpejoh.com</strong> is ready.</p><p>Click the link below to set your password and activate your account:</p><p><a href="${setupUrl}">${setupUrl}</a></p><p>This link expires in 48 hours.</p>`,
    text: `Hi,\n\nYour rawbin instance ${instance_slug}.rawbin.dpejoh.com is ready.\n\nClick this link to set your password:\n${setupUrl}\n\nThis link expires in 48 hours.`,
    env: c.env,
  });

  return c.json({ ok: true, instance_slug }, 201);
});

// ── Set-password routes ─────────────────────────────────────

app.get("/api/set-password", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const row = await c.env.DB.prepare(
    "SELECT email, instance_slug, used, expires_at FROM invite_tokens WHERE token = ?",
  ).bind(token).first<{ email: string; instance_slug: string; used: number; expires_at: string }>();
  if (!row) return c.json({ error: "Invalid token" }, 404);
  if (row.used) return c.json({ error: "Token already used" }, 400);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: "Token expired" }, 400);

  return c.json({ email: row.email, instance_slug: row.instance_slug });
});

app.post("/api/set-password", async (c) => {
  const body = await c.req.json<{ token?: string; password?: string }>();
  const token = body.token ?? "";
  const password = body.password ?? "";
  if (!token || !password) return c.json({ error: "Missing fields" }, 400);

  const row = await c.env.DB.prepare(
    "SELECT email, instance_slug, used, expires_at FROM invite_tokens WHERE token = ?",
  ).bind(token).first<{ email: string; instance_slug: string; used: number; expires_at: string }>();
  if (!row) return c.json({ error: "Invalid token" }, 404);
  if (row.used) return c.json({ error: "Token already used" }, 400);
  if (new Date(row.expires_at) < new Date()) return c.json({ error: "Token expired" }, 400);

  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  const stored = `${salt}:${hash}`;

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE email = ? AND instance_slug = ?",
    ).bind(stored, row.email, row.instance_slug),
    c.env.DB.prepare(
      "UPDATE invite_tokens SET used = 1 WHERE token = ?",
    ).bind(token),
    c.env.DB.prepare(
      "DELETE FROM sessions WHERE email = ? AND instance_slug = ?",
    ).bind(row.email, row.instance_slug),
  ]);

  return c.json({ ok: true });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email ?? "";
  const password = body.password ?? "";
  if (!email || !password) return c.json({ error: "Missing email or password" }, 400);

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ?",
  ).bind(email).first<{ email: string; password_hash: string; role: string; instance_slug: string }>();
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const [salt, hash] = (user.password_hash ?? "").split(":");
  if (!salt || !hash || !(await verifyPassword(password, salt, hash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const sid = crypto.randomUUID();
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({
    email: user.email,
    role: user.role,
    instance_slug: user.instance_slug,
    sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  await c.env.DB.prepare(
    "INSERT INTO sessions (id, email, role, instance_slug, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+7 days'))",
  ).bind(sid, user.email, user.role, user.instance_slug).run();

  return c.json({ token, email: user.email, role: user.role, slug: user.instance_slug });
});

app.post("/api/auth/logout", async (c) => {
  const token = parseAuthHeader(c.req.header("Authorization"));
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const sid = payload.sid as string;
    if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  } catch { /* already invalid */ }

  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const token = parseAuthHeader(c.req.header("Authorization"));
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const session = await verifyJWT(token, secret, c.env.DB);
  if (!session) return c.json({ error: "Invalid token or session expired" }, 401);

  return c.json({ email: session.email, role: session.role, slug: session.instance_slug });
});

// ── Health ────────────────────────────────────────────────────

app.get("/api/health", (c) => c.json({ ok: true }));

// ── Mount sub-routers ────────────────────────────────────────

app.route("/", clipboards);
app.route("/", r2);
app.route("/", apks);
app.route("/", modules);
app.route("/", files);
app.route("/", apps);
app.route("/", roles);
app.route("/", catalog);

// ── Backward compat: /raw/clips/:slug redirects to /clips/:slug ─

app.get("/raw/clips/:slug", async (c) => {
  const slug = c.req.param("slug");
  const base = new URL(c.req.url);
  return c.redirect(`/clips/${slug}${base.search}`, 301);
});

// ── Static assets (fallback) ─────────────────────────────────

app.all("/*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// ── Export ────────────────────────────────────────────────────

export default app;
