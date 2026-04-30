import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

interface ClipboardMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

async function getIndex(): Promise<ClipboardMeta[]> {
  const store = getStore("clipboards");
  const raw = await store.get("index");
  if (!raw) return [];
  return JSON.parse(raw) as ClipboardMeta[];
}

async function saveIndex(index: ClipboardMeta[]): Promise<void> {
  const store = getStore("clipboards");
  await store.set("index", JSON.stringify(index));
}

async function getContent(id: string): Promise<string | null> {
  const store = getStore("clipboards");
  return store.get(id);
}

async function setContent(id: string, content: string): Promise<void> {
  const store = getStore("clipboards");
  await store.set(id, content);
}

async function deleteContent(id: string): Promise<void> {
  const store = getStore("clipboards");
  await store.delete(id);
}

function isAuthenticated(context: HandlerContext): boolean {
  return Boolean(context.clientContext?.user);
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const method = event.httpMethod;
  const path = event.path;
  const segments = path.split("/").filter(Boolean);
  const id = segments[segments.length - 1];

  const isRawRequest = id && segments[segments.length - 2] === "clipboards" && id.length === 36;

  if (method === "GET" && isRawRequest) {
    const content = await getContent(id);
    if (!content) {
      return { statusCode: 404, body: "Not found" };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: content,
    };
  }

  if (!isAuthenticated(context)) {
    return { statusCode: 401, body: "Unauthorized" };
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
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      };
    }

    case "POST": {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}") as unknown;
      } catch {
        return { statusCode: 400, body: "Invalid JSON" };
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("name" in body) ||
        typeof (body as Record<string, unknown>).name !== "string"
      ) {
        return { statusCode: 400, body: "Invalid body" };
      }

      const name = (body as { name: string }).name.trim();
      if (!name) {
        return { statusCode: 400, body: "Name is required" };
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      const meta: ClipboardMeta = { id, name, createdAt: now, updatedAt: now };

      const index = await getIndex();
      index.push(meta);
      await saveIndex(index);
      await setContent(id, "");

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      };
    }

    case "PUT": {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}") as unknown;
      } catch {
        return { statusCode: 400, body: "Invalid JSON" };
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof (body as Record<string, unknown>).id !== "string"
      ) {
        return { statusCode: 400, body: "Invalid body" };
      }

      const putData = body as { id: string; name?: string; content?: string };
      const index = await getIndex();
      const item = index.find((i) => i.id === putData.id);
      if (!item) {
        return { statusCode: 404, body: "Not found" };
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

      return { statusCode: 200, body: "Updated" };
    }

    case "DELETE": {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}") as unknown;
      } catch {
        return { statusCode: 400, body: "Invalid JSON" };
      }

      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof (body as Record<string, unknown>).id !== "string"
      ) {
        return { statusCode: 400, body: "Invalid body" };
      }

      const delId = (body as { id: string }).id;
      const index = await getIndex();
      const idx = index.findIndex((i) => i.id === delId);
      if (idx === -1) {
        return { statusCode: 404, body: "Not found" };
      }

      index.splice(idx, 1);
      await saveIndex(index);
      await deleteContent(delId);

      return { statusCode: 200, body: "Deleted" };
    }

    default:
      return { statusCode: 405, body: "Method Not Allowed" };
  }
};

export { handler };
