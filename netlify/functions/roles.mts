import { getStore } from "@netlify/blobs";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const ROLE_HIERARCHY: Record<string, number> = { viewer: 0, editor: 1, admin: 2 };

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyToken(token: string): Promise<{ email: string; id: string } | null> {
  try {
    const res = await fetch(`${SITE_URL}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; id: string; sub?: string };
    return { email: data.email ?? "", id: data.id ?? data.sub ?? "" };
  } catch {
    return null;
  }
}

async function getAllRoles(): Promise<Record<string, string>> {
  try {
    const store = getStore("user-roles");
    const raw = await store.get("index");
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveAllRoles(roles: Record<string, string>): Promise<void> {
  const store = getStore("user-roles");
  await store.set("index", JSON.stringify(roles));
  await store.get("index");
}

function validRole(role: string): boolean {
  return role === "viewer" || role === "editor" || role === "admin";
}

async function getUserRole(email: string): Promise<string> {
  const roles = await getAllRoles();
  return roles[email] ?? "viewer";
}

async function requireRole(email: string, minRole: string): Promise<boolean> {
  const role = await getUserRole(email);
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

export default async (req: Request) => {
  try {
    const method = req.method;
    const url = new URL(req.url);

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) return fail("Unauthorized");

    const user = await verifyToken(token);
    if (!user) return fail("Unauthorized");

    const callerRole = await getUserRole(user.email);

    // Bootstrap: if store is empty and caller matches ADMIN_EMAIL, auto-promote
    const allRoles = await getAllRoles();
    if (Object.keys(allRoles).length === 0 && method === "GET" && user.email === ADMIN_EMAIL) {
      allRoles[user.email] = "admin";
      await saveAllRoles(allRoles);
      return ok({ email: user.email, role: "admin", bootstrap: true });
    }

    if (method === "GET") {
      const result: Record<string, unknown> = { email: user.email, role: callerRole };
      if (callerRole === "admin") {
        result.roles = allRoles;
      }
      return ok(result);
    }

    if (!await requireRole(user.email, "admin")) return fail("Forbidden");

    if (method === "POST") {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return fail("Invalid JSON");
      }

      const { email, role } = body as { email?: string; role?: string };
      if (!email || !role) return fail("Missing email or role");
      if (!validRole(role)) return fail("Invalid role. Must be: viewer, editor, or admin");

      allRoles[email] = role;
      await saveAllRoles(allRoles);

      return ok({ email, role });
    }

    if (method === "DELETE") {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return fail("Invalid JSON");
      }

      const { email } = body as { email?: string };
      if (!email) return fail("Missing email");

      const roles = await getAllRoles();
      if (!roles[email]) return fail("Not found");
      delete roles[email];
      await saveAllRoles(roles);

      return ok({ deleted: true });
    }

    return fail("Method Not Allowed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(msg);
  }
};
