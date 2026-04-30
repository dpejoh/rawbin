import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

interface ClipboardMeta {
  id: string;
  name: string;
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

export default async (
  req: Request,
  context: { clientContext?: { user?: { email?: string; id?: string } } }
) => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);
  const id = segments[segments.length - 1];

  const isRawRequest = id && segments.length >= 2 && segments[segments.length - 2] === "clipboards" && id.length === 36;

  if (method === "GET" && isRawRequest) {
    const content = await getContent(id);
    if (!content) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const user = context.clientContext?.user;
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

      const name = (body as { name: string }).name.trim();
      if (!name) {
        return new Response("Name is required", { status: 400 });
      }

      const clipId = randomUUID();
      const now = new Date().toISOString();
      const meta: ClipboardMeta = { id: clipId, name, createdAt: now, updatedAt: now };

      const index = await getIndex();
      index.push(meta);
      await saveIndex(index);
      await setContent(clipId, "");

      return new Response(JSON.stringify({ id: clipId }), {
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

      const putData = body as { id: string; name?: string; content?: string };
      const index = await getIndex();
      const item = index.find((i) => i.id === putData.id);
      if (!item) {
        return new Response("Not found", { status: 404 });
      }

      const now = new Date().toISOString();
      if (putData.name !== undefined) {
        item.name = putData.name.trim();
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
