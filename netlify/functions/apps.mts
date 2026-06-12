import { getStore } from "@netlify/blobs";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

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

const HIERARCHY: Record<string, number> = { viewer: 0, editor: 1, admin: 2 };

async function getUserRole(email: string): Promise<string> {
  try {
    const store = getStore("user-roles");
    const raw = await store.get("index");
    if (!raw) return "viewer";
    const roles = JSON.parse(raw) as Record<string, string>;
    return roles[email] ?? "viewer";
  } catch {
    return "viewer";
  }
}

async function requireRole(email: string, minRole: string): Promise<boolean> {
  const role = await getUserRole(email);
  return (HIERARCHY[role] ?? 0) >= (HIERARCHY[minRole] ?? 0);
}

interface AppCatalog {
  [packageName: string]: string;
}

function getStoreInstance() {
  return getStore("app-catalog");
}

async function getCatalog(): Promise<AppCatalog> {
  const store = getStoreInstance();
  const raw = await store.get("data");
  return raw ? JSON.parse(raw) : {};
}

async function saveCatalog(data: AppCatalog): Promise<void> {
  const store = getStoreInstance();
  await store.set("data", JSON.stringify(data, null, 2));
}

function filterCatalog(catalog: AppCatalog, query: string): AppCatalog {
  const q = query.toLowerCase();
  const result: AppCatalog = {};
  for (const [pkg, name] of Object.entries(catalog)) {
    if (pkg.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
      result[pkg] = name;
    }
  }
  return result;
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET") {
      if (url.pathname.endsWith("/save")) {
        return fail("Method Not Allowed");
      }

      const catalog = await getCatalog();
      const searchQuery = url.searchParams.get("q");
      const result = searchQuery ? filterCatalog(catalog, searchQuery) : catalog;
      return ok(result);
    }

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) return fail("Unauthorized");

    const user = await verifyToken(token);
    if (!user) return fail("Unauthorized");

    if (!await requireRole(user.email, "admin")) return fail("Forbidden");

    if (method === "POST") {
      const path = url.pathname;
      const isSave = path.endsWith("/save");

      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return fail("Invalid JSON");
      }

      if (isSave) {
        const { packageName, appName } = body as { packageName?: string; appName?: string };
        if (!packageName || !appName) {
          return fail("Missing packageName or appName");
        }
        const catalog = await getCatalog();
        catalog[packageName] = appName;
        await saveCatalog(catalog);
        return ok({ packageName, appName });
      }

      const entries = body as Array<{ packageName?: string; appName?: string }>;
      if (!Array.isArray(entries)) {
        return fail("Expected array of entries");
      }

      const catalog = await getCatalog();
      let imported = 0;
      for (const entry of entries) {
        if (!entry.packageName || !entry.appName) continue;
        catalog[entry.packageName] = entry.appName;
        imported++;
      }
      await saveCatalog(catalog);

      return ok({ imported, total: Object.keys(catalog).length });
    }

    if (method === "DELETE") {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return fail("Invalid JSON");
      }

      const { packageName } = body as { packageName?: string };
      if (!packageName) {
        return fail("Missing packageName");
      }

      const packages = Array.isArray(packageName) ? packageName : [packageName];
      const catalog = await getCatalog();
      let deleted = 0;
      for (const pkg of packages) {
        if (catalog[pkg]) {
          delete catalog[pkg];
          deleted++;
        }
      }
      await saveCatalog(catalog);

      return ok({ deleted });
    }

    return fail("Method Not Allowed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(msg);
  }
};
