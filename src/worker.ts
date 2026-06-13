/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { cors } from "hono/cors";
import { SignJWT, jwtVerify } from "jose";
import { verifyJWT, parseAuthHeader } from "./lib/auth";
import clipboards from "./handlers/clipboards";
import r2 from "./handlers/r2";
import apks from "./handlers/apks";
import modules from "./handlers/modules";

interface Env {
  DB: D1Database;
  RAW_BIN: R2Bucket;
  ASSETS: Fetcher;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

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
  const body = await c.req.json<{ email?: string; password?: string; instance_slug?: string }>();
  const email = body.email ?? "";
  const password = body.password ?? "";
  const instance_slug = body.instance_slug ?? "";
  if (!email || !password || !instance_slug) {
    return c.json({ error: "Missing fields" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT slug FROM instances WHERE slug = ?",
  ).bind(instance_slug).first();
  if (existing) return c.json({ error: "Instance already exists" }, 409);

  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  const stored = `${salt}:${hash}`;

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO instances (slug, owner_email) VALUES (?, ?)",
    ).bind(instance_slug, email),
    c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, role, instance_slug) VALUES (?, ?, 'admin', ?)",
    ).bind(email, stored, instance_slug),
  ]);

  return c.json({ ok: true, instance_slug }, 201);
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
