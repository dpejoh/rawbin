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

interface ApkMeta {
  id: string;
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  size: number;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

function getStoreInstance() {
  return getStore("apks");
}

async function flush(store: ReturnType<typeof getStoreInstance>, key?: string): Promise<void> {
  await store.get(key ?? "index");
}

async function getIndex(): Promise<ApkMeta[]> {
  const store = getStoreInstance();
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as ApkMeta[];
}

async function saveIndex(index: ApkMeta[]): Promise<void> {
  const store = getStoreInstance();
  await store.set("index", JSON.stringify(index));
  await flush(store);
}

async function deleteFromR2(blobId: string, token: string): Promise<void> {
  await fetch(`${R2_WORKER}/raw/apks/${blobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default async (req: Request) => {
  try {
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    const segments = path.split("/").filter(Boolean);
    const rawId = segments[segments.length - 1];

    const isRawRequest = method === "GET" && !!rawId && (
      (segments[0] === "apk" && segments.length >= 2) ||
      (segments[segments.length - 2] === "apks")
    );

    if (isRawRequest && rawId) {
      const index = await getIndex();
      const item = index.find((a) => a.packageName === rawId);
      if (!item) return new Response("Not found", { status: 404 });

      if (item.storage === STORAGE_R2) {
        const dlName = item.fileName || `${item.packageName}.apk`;
        return Response.redirect(`${R2_WORKER}/raw/apks/${item.id}?name=${encodeURIComponent(dlName)}`, 302);
      }

      const store = getStoreInstance();
      const stored = await store.get(item.id, { type: "json" });
      if (!stored || typeof stored !== "object" || !("bin" in stored)) {
        return new Response("Not found", { status: 404 });
      }
      const content = Buffer.from((stored as { bin: string }).bin, "base64");
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "application/vnd.android.package-archive" },
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
        const result = index.map(({ id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, fileName, createdAt, updatedAt }) => ({
          id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, fileName, createdAt, updatedAt,
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
        if (typeof body !== "object" || body === null) {
          return fail("Invalid body");
        }

        const b = body as Record<string, unknown>;

        // Rename-only: id + fileName without blobId
        if (b.id && b.fileName && !b.blobId) {
          const renameId = String(b.id);
          const newName = String(b.fileName).trim();
          if (!newName) return fail("fileName is required");
          const idx = await getIndex();
          const item = idx.find((a) => a.id === renameId || a.packageName === renameId);
          if (!item) return fail("Not found");
          item.fileName = newName;
          item.updatedAt = new Date().toISOString();
          await saveIndex(idx);
          return ok({ id: renameId, fileName: newName });
        }

        if (
          !("packageName" in b) || typeof (b as Record<string, unknown>).packageName !== "string"
        ) {
          return fail("Invalid body. Required: packageName");
        }

        const {
          packageName, appName, versionCode, versionName, minSdk, targetSdk,
          blobId, size, fileName,
        } = body as {
          packageName: string; appName?: string; versionCode?: number; versionName?: string;
          minSdk?: number; targetSdk?: number; blobId?: string; size?: number; fileName?: string;
        };

        if (!blobId) {
          return fail("Missing blobId");
        }

        const id = blobId;
        const now = new Date().toISOString();
        const meta: ApkMeta = {
          id, packageName: packageName.trim(),
          appName: appName ?? packageName.trim(),
          versionCode: versionCode ?? 0, versionName: versionName ?? "",
          minSdk: minSdk ?? 0, targetSdk: targetSdk ?? 0,
          size: size ?? 0, fileName, createdAt: now, updatedAt: now,
          storage: STORAGE_R2,
        };

        try {
          const idx = await getIndex();
          const existing = idx.findIndex((a) => a.packageName === meta.packageName);
          const oldEntry = existing !== -1 ? idx[existing] : null;
          if (existing !== -1) idx.splice(existing, 1);
          if (oldEntry) {
            if (!fileName && oldEntry.fileName) meta.fileName = oldEntry.fileName;
            if (oldEntry.id !== id) {
              if (oldEntry.storage === STORAGE_R2) deleteFromR2(oldEntry.id, token).catch(() => {});
              else await store.delete(oldEntry.id);
            }
          }
          idx.push(meta);
          await saveIndex(idx);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return fail("Internal error saving APK: " + msg);
        }

        return ok({ id, packageName: meta.packageName });
      }

      case "DELETE": {
        if (!await requireRole(user.email, "editor")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        const delId = (body as { id?: string; packageName?: string }).id || (body as { id?: string; packageName?: string }).packageName;
        if (!delId || typeof delId !== "string") {
          return fail("Invalid body. Required: id or packageName");
        }

        const index = await getIndex();
        const idx = index.findIndex((a) => a.id === delId || a.packageName === delId);
        if (idx === -1) return fail("Not found");

        const removed = index[idx]!;
        index.splice(idx, 1);
        await saveIndex(index);
        if (removed.storage === STORAGE_R2) {
          deleteFromR2(removed.id, token).catch(() => {});
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
    const msg = err instanceof Error ? err.message : String(err);
    return fail(msg);
  }
};
