import { getStore } from "@netlify/blobs";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;
const CORS = { "Access-Control-Allow-Origin": "*" };

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
  const url = new URL(req.url);
  const method = req.method;

  if (method === "GET") {
    const catalog = await getCatalog();
    const searchQuery = url.searchParams.get("q");
    const result = searchQuery ? filterCatalog(catalog, searchQuery) : catalog;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (method === "POST") {
    const path = url.pathname;
    const isSave = path.endsWith("/save");

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (isSave) {
      const { packageName, appName } = body as { packageName?: string; appName?: string };
      if (!packageName || !appName) {
        return new Response("Missing packageName or appName", { status: 400 });
      }
      const catalog = await getCatalog();
      catalog[packageName] = appName;
      await saveCatalog(catalog);
      return new Response(JSON.stringify({ packageName, appName }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const entries = body as Array<{ packageName?: string; appName?: string }>;
    if (!Array.isArray(entries)) {
      return new Response("Expected array of entries", { status: 400 });
    }

    const catalog = await getCatalog();
    let imported = 0;
    for (const entry of entries) {
      if (!entry.packageName || !entry.appName) continue;
      catalog[entry.packageName] = entry.appName;
      imported++;
    }
    await saveCatalog(catalog);

    return new Response(JSON.stringify({ imported, total: Object.keys(catalog).length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  if (method === "DELETE") {
    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { packageName } = body as { packageName?: string };
    if (!packageName) {
      return new Response("Missing packageName", { status: 400 });
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

    return new Response(JSON.stringify({ deleted }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

function serializeAppCatalog(data: AppCatalog): Record<string, string> {
  return data;
}
