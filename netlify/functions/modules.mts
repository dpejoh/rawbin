import { getStore } from "@netlify/blobs";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;
const R2_WORKER = process.env.R2_WORKER_URL ?? "http://localhost:8787";
const STORAGE_R2 = "r2";

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

interface ModuleMeta {
  id: string;
  moduleId: string;
  name: string;
  version: string;
  versionCode: number;
  author: string;
  description: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

function getStoreInstance() {
  return getStore("modules");
}

async function flush(store: ReturnType<typeof getStoreInstance>, key?: string): Promise<void> {
  await store.get(key ?? "index");
}

async function getIndex(): Promise<ModuleMeta[]> {
  const store = getStoreInstance();
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as ModuleMeta[];
}

async function saveIndex(index: ModuleMeta[]): Promise<void> {
  const store = getStoreInstance();
  await store.set("index", JSON.stringify(index));
  await flush(store);
}

async function deleteFromR2(blobId: string): Promise<void> {
  await fetch(`${R2_WORKER}/raw/modules/${blobId}`, { method: "DELETE" });
}

export default async (req: Request) => {
  try {
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    const segments = path.split("/").filter(Boolean);
    const rawId = segments[segments.length - 1];

    const isRawRequest = method === "GET" && !!rawId && (
      (segments[0] === "mod" && segments.length >= 2) ||
      (segments[segments.length - 2] === "modules")
    );

    if (isRawRequest && rawId) {
      const index = await getIndex();
      const item = index.find((m) => m.moduleId === rawId);
      if (!item) return new Response("Not found", { status: 404 });

      if (item.storage === STORAGE_R2) {
        return Response.redirect(`${R2_WORKER}/raw/modules/${item.id}`, 302);
      }

      const store = getStoreInstance();
      const stored = await store.get(item.id, { type: "json" });
      if (!stored || typeof stored !== "object" || !("bin" in stored)) {
        return new Response("Not found", { status: 404 });
      }
      const content = Buffer.from((stored as { bin: string }).bin, "base64");
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "application/zip" },
      });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (!token) return fail("Unauthorized");

    const user = await verifyToken(token);
    if (!user) return fail("Unauthorized");

    const store = getStoreInstance();

    switch (method) {
      case "GET": {
        const index = await getIndex();
        const result = index.map(({ id, moduleId, name, version, versionCode, author, description, size, createdAt, updatedAt }) => ({
          id, moduleId, name, version, versionCode, author, description, size, createdAt, updatedAt,
        }));
        return ok(result);
      }

      case "POST": {
        if (!await requireRole(user.email, "editor")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }
        if (
          typeof body !== "object" || body === null ||
          !("moduleId" in body) || typeof (body as Record<string, unknown>).moduleId !== "string" ||
          !("name" in body) || typeof (body as Record<string, unknown>).name !== "string"
        ) {
          return fail("Invalid body. Required: moduleId, name");
        }

        const {
          moduleId, name, version, versionCode, author, description,
          blobId, size,
        } = body as {
          moduleId: string; name: string; version?: string; versionCode?: number;
          author?: string; description?: string; blobId?: string; size?: number;
        };

        if (!blobId) return fail("Missing blobId");

        const id = blobId;
        const now = new Date().toISOString();
        const meta: ModuleMeta = {
          id, moduleId: moduleId.trim(), name: name.trim(),
          version: version ?? "1.0", versionCode: versionCode ?? 1,
          author: author ?? "", description: description ?? "",
          size: size ?? 0, createdAt: now, updatedAt: now,
          storage: STORAGE_R2,
        };

        try {
          const idx = await getIndex();
          const existing = idx.findIndex((m) => m.moduleId === meta.moduleId);
          const oldEntry = existing !== -1 ? idx[existing] : null;
          if (existing !== -1) idx.splice(existing, 1);
          idx.push(meta);
          if (oldEntry && oldEntry.id !== id) {
            if (oldEntry.storage === STORAGE_R2) deleteFromR2(oldEntry.id).catch(() => {});
            else await store.delete(oldEntry.id);
          }
          await saveIndex(idx);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return fail("Internal error saving module: " + msg);
        }

        return ok({ id, moduleId: meta.moduleId });
      }

      case "DELETE": {
        if (!await requireRole(user.email, "editor")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        const delId = (body as { id?: string; moduleId?: string }).id || (body as { id?: string; moduleId?: string }).moduleId;
        if (!delId || typeof delId !== "string") {
          return fail("Invalid body. Required: id or moduleId");
        }

        const index = await getIndex();
        const idx = index.findIndex((m) => m.id === delId || m.moduleId === delId);
        if (idx === -1) return fail("Not found");

        const removed = index[idx]!;
        index.splice(idx, 1);
        await saveIndex(index);
        if (removed.storage === STORAGE_R2) {
          deleteFromR2(removed.id).catch(() => {});
        } else {
          await store.delete(removed.id);
        }
        await flush(store);

        return ok({ deleted: true });
      }

      default:
        return fail("Method Not Allowed");
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return fail(msg);
  }
};
