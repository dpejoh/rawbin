/// <reference types="@cloudflare/workers-types" />
import { jwtVerify } from "jose";

export interface SessionPayload {
  email: string;
  role: string;
  instance_slug: string;
  sid: string;
}

export const ROLES = ["viewer", "yuri", "editor", "admin"] as const;
export const ROLE_HIERARCHY: Record<string, number> = { viewer: 0, yuri: 0, editor: 1, admin: 2 };

export function meetsRole(userRole: string | null, minRole: string): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

export function getInstanceSlug(request: Request, url?: URL): string {
  const paramSlug = url?.searchParams.get("instance") ?? url?.searchParams.get("slug");
  if (paramSlug) return paramSlug;

  const host = request.headers.get("host") ?? "";
  const parts = host.split(".");
  // bare domain (e.g. rawbin.dpejoh.com → 3 parts) → "admin"
  // subdomain (e.g. yuri.rawbin.dpejoh.com → 4 parts) → "yuri"
  if (parts.length >= 4) {
    return parts[0]!;
  }
  return "admin";
}

export function getAppDomain(request: Request): string {
  const host = request.headers.get("host") ?? "";
  return host || "rawbin.dpejoh.com";
}

export async function hashPassword(password: string, salt: string): Promise<string> {
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

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPassword(password, salt)) === hash;
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
