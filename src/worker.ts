/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./handlers/auth";
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
  origin: (origin) => {
    if (!origin) return "*";
    try {
      const u = new URL(origin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin;
      if (u.host === "rawbin.dpejoh.com" || u.host.endsWith(".rawbin.dpejoh.com")) return origin;
    } catch { /* invalid origin */ }
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// ── Health ────────────────────────────────────────────────────

app.get("/api/health", (c) => c.json({ ok: true }));

// ── Mount handlers ──────────────────────────────────────────

app.route("/", auth);
app.route("/", clipboards);
app.route("/", r2);
app.route("/", apks);
app.route("/", modules);
app.route("/", files);
app.route("/", apps);
app.route("/", roles);
app.route("/", catalog);

// ── Static assets (fallback) ─────────────────────────────────

app.all("/*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
