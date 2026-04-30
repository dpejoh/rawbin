import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

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

interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  isFolder?: boolean;
  createdAt: string;
  updatedAt: string;
}

function getStoreInstance() {
  return getStore("files");
}

async function getIndex(): Promise<FileMeta[]> {
  const store = getStoreInstance();
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as FileMeta[];
}

async function saveIndex(index: FileMeta[]): Promise<void> {
  const store = getStoreInstance();
  await store.set("index", JSON.stringify(index));
}

async function getContent(id: string): Promise<string | null> {
  const store = getStoreInstance();
  return store.get(id);
}

async function setContent(id: string, content: string): Promise<void> {
  const store = getStoreInstance();
  await store.set(id, content);
}

async function deleteContent(id: string): Promise<void> {
  const store = getStoreInstance();
  await store.delete(id);
}

function collectDescendants(index: FileMeta[], parentId: string): string[] {
  const ids: string[] = [];
  const children = index.filter((f) => f.parentId === parentId);
  for (const child of children) {
    ids.push(child.id);
    if (child.isFolder) {
      ids.push(...collectDescendants(index, child.id));
    }
  }
  return ids;
}

export default async (req: Request) => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);
  const rawId = segments[segments.length - 1];

  const isRawRequest = method === "GET" && !!rawId && (
    (segments[0] === "file" && segments.length >= 2) ||
    (segments[segments.length - 2] === "files")
  );

  if (isRawRequest && rawId) {
    const index = await getIndex();
    const item = index.find((f) => f.id === rawId);
    if (!item || item.isFolder) {
      return new Response("Not found", { status: 404 });
    }
    const content = await getContent(item.id);
    if (!content) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": item.mimeType },
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

  switch (method) {
    case "GET": {
      const index = await getIndex();
      const parentId = url.searchParams.get("parentId") ?? "";
      const filtered = parentId
        ? index.filter((f) => f.parentId === parentId)
        : index;
      const result = filtered.map(({ id, name, mimeType, size, parentId, isFolder, createdAt, updatedAt }) => ({
        id, name, mimeType, size, parentId, isFolder, createdAt, updatedAt,
      }));
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "POST": {
      const contentType = req.headers.get("content-type") ?? "";
      const isFolderEndpoint = url.searchParams.has("folder");

      if (isFolderEndpoint) {
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (
          typeof body !== "object" || body === null ||
          !("name" in body) || typeof (body as Record<string, unknown>).name !== "string"
        ) {
          return new Response("Invalid body. Required: name", { status: 400 });
        }
        const { name, parentId } = body as { name: string; parentId?: string };
        if (!name.trim()) {
          return new Response("Name is required", { status: 400 });
        }
        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: FileMeta = {
          id, name: name.trim(), mimeType: "inode/directory", size: 0,
          parentId: parentId ?? "", isFolder: true, createdAt: now, updatedAt: now,
        };
        const index = await getIndex();
        index.push(meta);
        await saveIndex(index);
        return new Response(JSON.stringify({ id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (contentType.includes("application/json")) {
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (
          typeof body !== "object" || body === null ||
          !("name" in body) || typeof (body as Record<string, unknown>).name !== "string" ||
          !("content" in body) || typeof (body as Record<string, unknown>).content !== "string" ||
          !("mimeType" in body) || typeof (body as Record<string, unknown>).mimeType !== "string"
        ) {
          return new Response("Invalid body. Required: name, content (base64), mimeType", { status: 400 });
        }

        const { name, content, mimeType, parentId } = body as { name: string; content: string; mimeType: string; parentId?: string };
        const size = Buffer.from(content, "base64").length;
        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: FileMeta = { id, name, mimeType, size, parentId: parentId ?? "", createdAt: now, updatedAt: now };

        const index = await getIndex();
        index.push(meta);
        await saveIndex(index);
        await setContent(id, content);

        return new Response(JSON.stringify({ id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.searchParams.has("url")) {
        const name = url.searchParams.get("name") ?? "unnamed";
        const fileUrl = url.searchParams.get("url") ?? "";
        const parentId = url.searchParams.get("parentId") ?? "";
        if (!fileUrl) {
          return new Response("url query param is required", { status: 400 });
        }

        let fileRes: Response;
        try {
          fileRes = await fetch(fileUrl);
        } catch {
          return new Response("Failed to fetch URL", { status: 400 });
        }
        if (!fileRes.ok) {
          return new Response(`Remote returned ${fileRes.status}`, { status: 400 });
        }

        const mimeType = fileRes.headers.get("content-type") ?? "application/octet-stream";
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const size = arrayBuffer.byteLength;

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: FileMeta = { id, name, mimeType, size, parentId, createdAt: now, updatedAt: now };

        const index = await getIndex();
        index.push(meta);
        await saveIndex(index);
        await setContent(id, base64);

        return new Response(JSON.stringify({ id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Send JSON body or use ?url&name= query params", { status: 400 });
    }

    case "DELETE": {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (
        typeof body !== "object" || body === null ||
        !("id" in body) || typeof (body as Record<string, unknown>).id !== "string"
      ) {
        return new Response("Invalid body", { status: 400 });
      }

      const delId = (body as { id: string }).id;
      const index = await getIndex();
      const item = index.find((f) => f.id === delId);
      if (!item) {
        return new Response("Not found", { status: 404 });
      }

      const idsToDelete = [delId, ...collectDescendants(index, delId)];
      const newIndex = index.filter((f) => !idsToDelete.includes(f.id));
      await saveIndex(newIndex);
      for (const id of idsToDelete) {
        await deleteContent(id);
      }

      return new Response("Deleted", { status: 200 });
    }

    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
};
