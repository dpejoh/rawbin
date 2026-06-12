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
}

function getStoreInstance() {
  return getStore("modules");
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
}

function parseModuleProp(zip: AdmZip): Record<string, string> {
  const entry = zip.getEntry("module.prop");
  if (!entry) return {};
  const text = entry.getData().toString("utf-8");
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
}

export default async (req: Request) => {
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
      headers: { "Content-Type": "application/zip" },
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
      const result = index.map(({ id, moduleId, name, version, versionCode, author, description, size, createdAt, updatedAt }) => ({
        id, moduleId, name, version, versionCode, author, description, size, createdAt, updatedAt,
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
          !("moduleId" in body) || typeof (body as Record<string, unknown>).moduleId !== "string" ||
          !("name" in body) || typeof (body as Record<string, unknown>).name !== "string"
        ) {
          return new Response("Invalid body. Required: moduleId, name", { status: 400 });
        }

        const { moduleId, name, version, versionCode, author, description, content: bodyContent } = body as {
          moduleId: string; name: string; version?: string; versionCode?: number; author?: string; description?: string; content?: string;
        };

        const buf = bodyContent ? Buffer.from(bodyContent, "base64") : Buffer.alloc(0);
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: ModuleMeta = {
          id, moduleId: moduleId.trim(), name: name.trim(),
          version: version ?? "1.0", versionCode: versionCode ?? 1,
          author: author ?? "", description: description ?? "",
          size: buf.byteLength, createdAt: now, updatedAt: now,
        };

        const index = await getIndex();
        const existing = index.findIndex((m) => m.moduleId === meta.moduleId);
        if (existing !== -1) {
          index.splice(existing, 1);
        }
        index.push(meta);
        await saveIndex(index);
        if (bodyContent) await store.set(id, ab);

        return new Response(JSON.stringify({ id, moduleId: meta.moduleId }), {
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
        const zip = new AdmZip(Buffer.from(arrayBuffer));
        const props = parseModuleProp(zip);

        const moduleId = (formData.get("moduleId") as string) || props.id || file.name.replace(/\.zip$/i, "").trim();
        const name = (formData.get("name") as string) || props.name || moduleId;
        const version = (formData.get("version") as string) || props.version || "1.0";
        const versionCodeStr = (formData.get("versionCode") as string) || props.versionCode || "1";
        const author = (formData.get("author") as string) || props.author || "";
        const description = (formData.get("description") as string) || props.description || "";

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: ModuleMeta = {
          id, moduleId: moduleId.trim(), name: name.trim(),
          version, versionCode: parseInt(versionCodeStr, 10) || 1,
          author: author.trim(), description: description.trim(),
          size: arrayBuffer.byteLength, createdAt: now, updatedAt: now,
        };

        const index = await getIndex();
        const existing = index.findIndex((m) => m.moduleId === meta.moduleId);
        if (existing !== -1) {
          index.splice(existing, 1);
        }
        index.push(meta);
        await saveIndex(index);
        await store.set(id, arrayBuffer);

        return new Response(JSON.stringify({ id, moduleId: meta.moduleId }), {
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

      const delId = (body as { id?: string; moduleId?: string }).id || (body as { id?: string; moduleId?: string }).moduleId;
      if (!delId || typeof delId !== "string") {
        return new Response("Invalid body. Required: id or moduleId", { status: 400 });
      }

      const index = await getIndex();
      const idx = index.findIndex((m) => m.id === delId || m.moduleId === delId);
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
