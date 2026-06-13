import { getStore } from "@netlify/blobs";
import { ok, fail, extractToken, verifyRequest, requireRole } from "./_auth.mjs";

const R2_WORKER = process.env.R2_WORKER_URL ?? "http://localhost:8787";
const STORAGE_R2 = "r2";

interface ApkMeta {
  id: string;
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  size: number;
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
  try {
    const res = await fetch(`${R2_WORKER}/raw/apks/${blobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) console.error("R2 delete failed:", blobId, res.status);
  } catch (err) {
    console.error("R2 delete error:", blobId, err);
  }
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
        return Response.redirect(`${R2_WORKER}/raw/apks/${encodeURIComponent(`${item.packageName}.apk`)}`, 302);
      }

      const store = getStoreInstance();
      const stored = await store.get(item.id, { type: "json" });
      if (!stored || typeof stored !== "object" || !("bin" in stored)) {
        return new Response("Not found", { status: 404 });
      }
      const content = Buffer.from((stored as { bin: string }).bin, "base64");
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.android.package-archive",
        },
      });
    }

    const token = extractToken(req);
    if (!token) return fail("Unauthorized");
    const auth = await verifyRequest();
    if (!auth) return fail("Unauthorized");

    const store = getStoreInstance();

    switch (method) {
      case "GET": {
        const index = await getIndex();
        const result = index.map(({ id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, createdAt, updatedAt }) => ({
          id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, createdAt, updatedAt,
        }));
        return ok(result);
      }

      case "POST": {
        if (!await requireRole(auth.email, "editor", auth.roles)) return fail("Forbidden");
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

        // Metadata update: id without blobId — update any provided fields
        if (b.id && !b.blobId) {
          const updateId = String(b.id);
          const idx = await getIndex();
          const item = idx.find((a) => a.id === updateId || a.packageName === updateId);
          if (!item) return fail("Not found");
          if (typeof b.packageName === 'string') item.packageName = b.packageName.trim();
          if (typeof b.appName === 'string') item.appName = b.appName.trim();
          if (typeof b.versionCode === 'number') item.versionCode = b.versionCode;
          if (typeof b.versionName === 'string') item.versionName = b.versionName.trim();
          item.updatedAt = new Date().toISOString();
          await saveIndex(idx);
          return ok({ id: updateId });
        }

        if (
          !("packageName" in b) || typeof (b as Record<string, unknown>).packageName !== "string"
        ) {
          return fail("Invalid body. Required: packageName");
        }

        const {
          packageName, appName, versionCode, versionName, minSdk, targetSdk,
          blobId, size,
        } = body as {
          packageName: string; appName?: string; versionCode?: number; versionName?: string;
          minSdk?: number; targetSdk?: number; blobId?: string; size?: number;
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
          size: size ?? 0, createdAt: now, updatedAt: now,
          storage: STORAGE_R2,
        };

        try {
          const idx = await getIndex();
          const existing = idx.findIndex((a) => a.packageName === meta.packageName);
          const oldEntry = existing !== -1 ? idx[existing] : null;
          if (existing !== -1) idx.splice(existing, 1);
          if (oldEntry) {
            meta.appName = oldEntry.appName;
            if (oldEntry.id !== id) {
              if (oldEntry.storage === STORAGE_R2) deleteFromR2(oldEntry.id, token);
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
        if (!await requireRole(auth.email, "editor", auth.roles)) return fail("Forbidden");
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
          deleteFromR2(removed.id, token);
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
