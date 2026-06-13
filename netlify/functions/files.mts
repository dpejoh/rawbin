import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { ok, fail, extractToken, verifyRequest, requireRole } from "./_auth.mjs";

const R2_WORKER = process.env.R2_WORKER_URL ?? "http://localhost:8787";
const STORAGE_R2 = "r2";

interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  isFolder?: boolean;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

function getStoreInstance() {
  return getStore("files");
}

async function flush(store: ReturnType<typeof getStoreInstance>): Promise<void> {
  await store.get("index");
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
  await flush(store);
}

async function deleteContent(id: string): Promise<void> {
  const store = getStoreInstance();
  await store.delete(id);
}

async function deleteFromR2(blobId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`${R2_WORKER}/raw/files/${blobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) console.error("R2 delete failed:", blobId, res.status);
  } catch (err) {
    console.error("R2 delete error:", blobId, err);
  }
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
  try {
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

      let item: FileMeta | undefined;

      if (rawId.length === 36) {
        item = index.find((f) => f.id === rawId);
      }

      if (!item) {
        const pathParts = segments.slice(1);
        let parentId = "";
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i]!;
          const candidates = index.filter((f) => f.parentId === parentId && f.name === part);
          if (i === pathParts.length - 1) {
            item = candidates.find((f) => !f.isFolder);
          } else {
            const folder = candidates.find((f) => f.isFolder);
            if (!folder) break;
            parentId = folder.id;
          }
        }
      }

      if (!item || item.isFolder) {
        return new Response("Not found", { status: 404 });
      }

      if (item.storage === STORAGE_R2) {
        return Response.redirect(`${R2_WORKER}/raw/files/${item.id}?name=${encodeURIComponent(item.name)}`, 302);
      }

      const store = getStoreInstance();
      const content = await store.get(item.id, { type: "arrayBuffer" });
      if (!content) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(content, {
        status: 200,
        headers: { "Content-Type": item.mimeType },
      });
    }

    const token = extractToken(req);
    if (!token) return fail("Unauthorized");
    const user = await verifyRequest();
    if (!user) return fail("Unauthorized");

    const store = getStoreInstance();

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
        return ok(result);
      }

      case "POST": {
        if (!await requireRole(user.email, "editor")) return fail("Forbidden");
        const contentType = req.headers.get("content-type") ?? "";
        const isFolderEndpoint = url.searchParams.has("folder");

        if (isFolderEndpoint) {
          let body: unknown;
          try {
            body = (await req.json()) as unknown;
          } catch {
            return fail("Invalid JSON");
          }
          if (
            typeof body !== "object" || body === null ||
            !("name" in body) || typeof (body as Record<string, unknown>).name !== "string"
          ) {
            return fail("Invalid body. Required: name");
          }
          const { name, parentId } = body as { name: string; parentId?: string };
          if (!name.trim()) {
            return fail("Name is required");
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
          return ok({ id });
        }

        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        if (
          typeof body !== "object" || body === null ||
          !("name" in body) || typeof (body as Record<string, unknown>).name !== "string"
        ) {
          return fail("Invalid body. Required: name");
        }

        const { name, blobId, size: bodySize, mimeType, content, parentId: bodyParentId } = body as {
          name: string; blobId?: string; size?: number; mimeType?: string; content?: string; parentId?: string;
        };

        if (blobId) {
          // R2-stored file: accept blobId + metadata only
          const id = blobId;
          const now = new Date().toISOString();
          const meta: FileMeta = {
            id, name, mimeType: mimeType ?? "application/octet-stream",
            size: bodySize ?? 0, parentId: bodyParentId ?? "",
            createdAt: now, updatedAt: now, storage: STORAGE_R2,
          };

          const index = await getIndex();
          index.push(meta);
          await saveIndex(index);
          return ok({ id });
        }

        // Legacy base64 upload
        if (!content || !mimeType) {
          return fail("Missing content (base64) and mimeType, or blobId");
        }

        const buf = Buffer.from(content, "base64");
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const fileSize = buf.byteLength;

        const id = randomUUID();
        const now = new Date().toISOString();
        const meta: FileMeta = { id, name, mimeType, size: fileSize, parentId: bodyParentId ?? "", createdAt: now, updatedAt: now };
        const index = await getIndex();
        index.push(meta);
        await saveIndex(index);
        await store.set(id, ab);

        return ok({ id });
      }

      case "DELETE": {
        if (!await requireRole(user.email, "editor")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        if (
          typeof body !== "object" || body === null ||
          !("id" in body) || typeof (body as Record<string, unknown>).id !== "string"
        ) {
          return fail("Invalid body");
        }

        const delId = (body as { id: string }).id;
        const index = await getIndex();
        const item = index.find((f) => f.id === delId);
        if (!item) return fail("Not found");

        const idsToDelete = [delId, ...collectDescendants(index, delId)];
        const newIndex = index.filter((f) => !idsToDelete.includes(f.id));
        await saveIndex(newIndex);
        for (const id of idsToDelete) {
          const f = index.find((f) => f.id === id);
          if (f?.storage === STORAGE_R2) {
            deleteFromR2(id, token);
          } else {
            await deleteContent(id);
          }
        }

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
