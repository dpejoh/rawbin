/// <reference types="@cloudflare/workers-types" />
import { jwtVerify } from "jose";

export interface SessionPayload {
  email: string;
  role: string;
  instance_slug: string;
  sid: string;
}

export function getInstanceSlug(request: Request, url?: URL): string {
  // Allow explicit override via ?instance= param
  const paramSlug = url?.searchParams.get("instance") ?? url?.searchParams.get("slug");
  if (paramSlug) return paramSlug;

  const host = request.headers.get("host") ?? "";
  // e.g. yuri.rawbin.dpejoh.com → "yuri"
  // e.g. rawbin.khaledxbz.workers.dev → "rawbin" (fallback to "admin")
  const match = host.match(/^([^.]+)/);
  return match ? match[1]! : "admin";
}

export async function verifyJWT(
  token: string,
  secret: Uint8Array,
  db: D1Database,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const sid = payload.sid as string;
    const session = await db.prepare(
      "SELECT email, role, instance_slug FROM sessions WHERE id = ? AND expires_at > datetime('now')",
    ).bind(sid).first<{ email: string; role: string; instance_slug: string }>();
    if (!session) return null;
    return {
      email: session.email,
      role: session.role,
      instance_slug: session.instance_slug,
      sid,
    };
  } catch {
    return null;
  }
}

export function parseAuthHeader(auth: string | null | undefined): string | null {
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]! : null;
}
