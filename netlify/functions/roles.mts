import { getStore } from "@netlify/blobs";
import { admin } from "@netlify/identity";
import { ok, fail, extractToken, verifyRequest, getEffectiveRole, requireRole } from "./_auth.mjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function getAllCustomRoles(): Promise<Record<string, string>> {
  try {
    const store = getStore("user-roles");
    const raw = await store.get("index");
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveAllCustomRoles(roles: Record<string, string>): Promise<void> {
  const store = getStore("user-roles");
  await store.set("index", JSON.stringify(roles));
  await store.get("index");
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  try {
    const users = await admin.listUsers();
    const user = users.find((u) => u.email === email);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function setIdentityRole(email: string, newRole: string): Promise<void> {
  const userId = await findUserIdByEmail(email);
  if (!userId) return;
  try {
    await admin.updateUser(userId, { app_metadata: { roles: [newRole] } });
  } catch (err) {
    console.error("Failed to update Netlify Identity role:", email, err);
  }
}

function validRole(role: string): boolean {
  return role === "viewer" || role === "editor" || role === "admin" || role === "yuri";
}

export default async (req: Request) => {
  try {
    const method = req.method;
    const url = new URL(req.url);

    const token = extractToken(req);
    if (!token) return fail("Unauthorized");

    const auth = await verifyRequest();
    if (!auth) return fail("Unauthorized");

    const callerRole = await getEffectiveRole(auth.email, auth.roles);

    // Bootstrap: if custom store is empty and caller matches ADMIN_EMAIL, auto-promote
    const allCustomRoles = await getAllCustomRoles();
    if (Object.keys(allCustomRoles).length === 0 && method === "GET" && auth.email === ADMIN_EMAIL) {
      allCustomRoles[auth.email] = "admin";
      await saveAllCustomRoles(allCustomRoles);
      await setIdentityRole(auth.email, "admin");
      return ok({ email: auth.email, role: "admin", bootstrap: true });
    }

    if (method === "GET") {
      const result: Record<string, unknown> = { email: auth.email, role: callerRole };
      if (callerRole === "admin") {
        result.roles = allCustomRoles;
      }
      return ok(result);
    }

    if (!await requireRole(auth.email, "admin", auth.roles)) return fail("Forbidden");

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

      allCustomRoles[email] = role;
      await saveAllCustomRoles(allCustomRoles);
      await setIdentityRole(email, role);

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

      const roles = await getAllCustomRoles();
      if (!roles[email]) return fail("Not found");
      delete roles[email];
      await saveAllCustomRoles(roles);
      // Remove role from Netlify Identity user record
      await setIdentityRole(email, "viewer");

      return ok({ deleted: true });
    }

    return fail("Method Not Allowed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(msg);
  }
};
