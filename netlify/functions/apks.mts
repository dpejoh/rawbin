import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

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
}

function getStoreInstance() {
  return getStore("apks");
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
}

export default async (req: Request) => {
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
    if (!item) {
      return new Response("Not found", { status: 404 });
    }
    const store = getStoreInstance();
    const content = await store.get(item.id, { type: "arrayBuffer" });
    if (!content) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "application/vnd.android.package-archive" },
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

  const store = getStoreInstance();

  switch (method) {
    case "GET": {
      const index = await getIndex();
      const result = index.map(({ id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, createdAt, updatedAt }) => ({
        id, packageName, appName, versionCode, versionName, minSdk, targetSdk, size, createdAt, updatedAt,
      }));
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "POST": {
      const contentType = req.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (
          typeof body !== "object" || body === null ||
          !("packageName" in body) || typeof (body as Record<string, unknown>).packageName !== "string"
        ) {
          return new Response("Invalid body. Required: packageName", { status: 400 });
        }

        const { packageName, appName, versionCode, versionName, minSdk, targetSdk, content: bodyContent } = body as {
          packageName: string; appName?: string; versionCode?: number; versionName?: string; minSdk?: number; targetSdk?: number; content?: string;
        };

        const buf = bodyContent ? Buffer.from(bodyContent, "base64") : Buffer.alloc(0);
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: ApkMeta = {
          id, packageName: packageName.trim(),
          appName: appName ?? packageName.trim(),
          versionCode: versionCode ?? 0, versionName: versionName ?? "",
          minSdk: minSdk ?? 0, targetSdk: targetSdk ?? 0,
          size: buf.byteLength, createdAt: now, updatedAt: now,
        };

        const index = await getIndex();
        const existing = index.findIndex((a) => a.packageName === meta.packageName);
        const oldId = existing !== -1 ? index[existing]!.id : null;
        if (existing !== -1) {
          index.splice(existing, 1);
        }
        index.push(meta);
        await saveIndex(index);
        if (bodyContent) await store.set(id, ab);
        if (oldId && oldId !== id) await store.delete(oldId);

        return new Response(JSON.stringify({ id, packageName: meta.packageName }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const formData = await req.formData().catch(() => null);
      if (formData) {
        const file = formData.get("file") as File | null;
        if (!file) {
          return new Response("Missing file field", { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const packageName = (formData.get("packageName") as string) || file.name.replace(/\.apk$/i, "").trim();
        const appName = (formData.get("appName") as string) || packageName;
        const versionCode = parseInt(formData.get("versionCode") as string || "0", 10) || 0;
        const versionName = (formData.get("versionName") as string) || "";
        const minSdk = parseInt(formData.get("minSdk") as string || "0", 10) || 0;
        const targetSdk = parseInt(formData.get("targetSdk") as string || "0", 10) || 0;

        // validate that it's actually an APK (ZIP containing AndroidManifest.xml)
        try {
          const zip = new AdmZip(Buffer.from(arrayBuffer));
          if (!zip.getEntry("AndroidManifest.xml")) {
            return new Response("Invalid APK: missing AndroidManifest.xml", { status: 400 });
          }
          if (!zip.getEntry("classes.dex")) {
            return new Response("Invalid APK: missing classes.dex", { status: 400 });
          }
        } catch {
          return new Response("Invalid APK: not a valid ZIP", { status: 400 });
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: ApkMeta = {
          id, packageName: packageName.trim(),
          appName: appName.trim(),
          versionCode, versionName: versionName.trim(),
          minSdk, targetSdk,
          size: arrayBuffer.byteLength, createdAt: now, updatedAt: now,
        };

        const index = await getIndex();
        const existing = index.findIndex((a) => a.packageName === meta.packageName);
        const oldId = existing !== -1 ? index[existing]!.id : null;
        if (existing !== -1) {
          index.splice(existing, 1);
        }
        index.push(meta);
        await saveIndex(index);
        await store.set(id, arrayBuffer);
        if (oldId && oldId !== id) await store.delete(oldId);

        return new Response(JSON.stringify({ id, packageName: meta.packageName }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Unexpected content type", { status: 400 });
    }

    case "DELETE": {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const delId = (body as { id?: string; packageName?: string }).id || (body as { id?: string; packageName?: string }).packageName;
      if (!delId || typeof delId !== "string") {
        return new Response("Invalid body. Required: id or packageName", { status: 400 });
      }

      const index = await getIndex();
      const idx = index.findIndex((a) => a.id === delId || a.packageName === delId);
      if (idx === -1) {
        return new Response("Not found", { status: 404 });
      }

      const removed = index[idx]!;
      index.splice(idx, 1);
      await saveIndex(index);
      await store.delete(removed.id);

      return new Response("Deleted", { status: 200 });
    }

    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
};
