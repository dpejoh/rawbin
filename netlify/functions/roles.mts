import { getStore } from "@netlify/blobs";
import { ok, fail, extractToken, verifyRequest, getUserRole, requireRole } from "./_auth.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

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

export default async (req: Request) => {
  try {
    const method = req.method;
    const url = new URL(req.url);

    const token = extractToken(req);
    if (!token) return fail("Unauthorized");

    const user = await verifyRequest();
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
