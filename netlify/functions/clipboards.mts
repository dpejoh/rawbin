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

interface ClipboardMeta {
  id: string;
  name: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
}

function getStoreInstance() {
  return getStore("clipboards");
}

async function getIndex(): Promise<ClipboardMeta[]> {
  const store = getStoreInstance();
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as ClipboardMeta[];
}

async function saveIndex(index: ClipboardMeta[]): Promise<void> {
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

function findBySlug(index: ClipboardMeta[], slugOrId: string): ClipboardMeta | undefined {
  return index.find((c) => c.id === slugOrId || c.slug === slugOrId);
}

function isValidSlug(s: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(s);
}

export default async (req: Request) => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);
  const rawId = segments[segments.length - 1];

  const isRawRequest = rawId && segments.length >= 2 && segments[segments.length - 2] === "clipboards";

  if (method === "GET" && isRawRequest) {
    const index = await getIndex();
    const item = findBySlug(index, rawId);
    if (!item) {
      return new Response("Not found", { status: 404 });
    }
    const content = await getContent(item.id);
    if (!content) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
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
      const contentMap: Record<string, string | null> = {};
      for (const item of index) {
        contentMap[item.id] = await getContent(item.id);
      }
      const result = index.map((item) => ({
        ...item,
        content: contentMap[item.id] ?? "",
      }));
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "POST": {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("name" in body) ||
        typeof (body as Record<string, unknown>).name !== "string"
      ) {
        return new Response("Invalid body", { status: 400 });
      }

      const { name, slug } = body as { name: string; slug?: string };
      const trimmedName = name.trim();
      if (!trimmedName) {
        return new Response("Name is required", { status: 400 });
      }

      if (slug !== undefined && slug !== "") {
        const trimmedSlug = slug.trim();
        if (!isValidSlug(trimmedSlug)) {
          return new Response("Slug must be alphanumeric (hyphens and underscores allowed)", { status: 400 });
        }
        const index = await getIndex();
        if (index.some((c) => c.slug === trimmedSlug)) {
          return new Response("Slug already in use", { status: 409 });
        }
      }

      const clipId = randomUUID();
      const now = new Date().toISOString();
      const meta: ClipboardMeta = {
        id: clipId,
        name: trimmedName,
        createdAt: now,
        updatedAt: now,
      };
      if (slug) meta.slug = slug.trim();

      const index = await getIndex();
      index.push(meta);
      await saveIndex(index);
      await setContent(clipId, "");

      return new Response(JSON.stringify({ id: clipId, slug: meta.slug }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    case "PUT": {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof (body as Record<string, unknown>).id !== "string"
      ) {
        return new Response("Invalid body", { status: 400 });
      }

      const putData = body as { id: string; name?: string; content?: string; slug?: string };
      const index = await getIndex();
      const item = index.find((i) => i.id === putData.id);
      if (!item) {
        return new Response("Not found", { status: 404 });
      }

      const now = new Date().toISOString();

      if (putData.name !== undefined) {
        item.name = putData.name.trim();
      }

      if (putData.slug !== undefined) {
        const trimmedSlug = putData.slug.trim();
        if (trimmedSlug !== "") {
          if (!isValidSlug(trimmedSlug)) {
            return new Response("Slug must be alphanumeric (hyphens and underscores allowed)", { status: 400 });
          }
          if (index.some((c) => c.slug === trimmedSlug && c.id !== putData.id)) {
            return new Response("Slug already in use", { status: 409 });
          }
          item.slug = trimmedSlug;
        } else {
          item.slug = undefined;
        }
      }

      if (putData.content !== undefined) {
        const encoded = Buffer.from(putData.content).toString("base64");
        await setContent(item.id, encoded);
      }
      item.updatedAt = now;
      await saveIndex(index);

      return new Response("Updated", { status: 200 });
    }

    case "DELETE": {
      let body: unknown;
      try {
        body = (await req.json()) as unknown;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof (body as Record<string, unknown>).id !== "string"
      ) {
        return new Response("Invalid body", { status: 400 });
      }

      const delId = (body as { id: string }).id;
      const index = await getIndex();
      const idx = index.findIndex((i) => i.id === delId);
      if (idx === -1) {
        return new Response("Not found", { status: 404 });
      }

      index.splice(idx, 1);
      await saveIndex(index);
      await deleteContent(delId);

      return new Response("Deleted", { status: 200 });
    }

    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
};
