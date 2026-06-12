import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const SITE_URL = process.env.URL ?? `https://${process.env.SITE_NAME}.netlify.app`;

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

interface ClipboardMeta {
  id: string;
  name: string;
  slug?: string;
  useBase64?: boolean;
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
  try {
    const method = req.method;
    const url = new URL(req.url);
    const path = url.pathname;
    const segments = path.split("/").filter(Boolean);
    const rawId = segments[segments.length - 1];

    const isRawRequest = method === "GET" && !!rawId && (
      (segments[0] === "clips" && segments.length >= 2) ||
      (segments[segments.length - 2] === "clipboards")
    );

    if (isRawRequest && rawId) {
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
    if (!token) return fail("Unauthorized");

    const user = await verifyToken(token);
    if (!user) return fail("Unauthorized");

    switch (method) {
      case "GET": {
        const index = await getIndex();
        const result = await Promise.all(
          index.map(async (item) => {
            const content = await getContent(item.id);
            return { ...item, content: content ?? "" };
          }),
        );
        return ok(result);
      }

      case "POST": {
        if (!await requireRole(user.email, "admin")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("name" in body) ||
          typeof (body as Record<string, unknown>).name !== "string"
        ) {
          return fail("Invalid body");
        }

        const { name, slug, useBase64: useBase64Post } = body as { name: string; slug?: string; useBase64?: boolean };
        const trimmedName = name.trim();
        if (!trimmedName) {
          return fail("Name is required");
        }

        if (slug !== undefined && slug !== "") {
          const trimmedSlug = slug.trim();
          if (!isValidSlug(trimmedSlug)) {
            return fail("Slug must be alphanumeric (hyphens and underscores allowed)");
          }
          const index = await getIndex();
          if (index.some((c) => c.slug === trimmedSlug)) {
            return fail("Slug already in use");
          }
        }

        const clipId = randomUUID();
        const now = new Date().toISOString();
        const meta: ClipboardMeta = {
          id: clipId,
          name: trimmedName,
          useBase64: useBase64Post !== false,
          createdAt: now,
          updatedAt: now,
        };
        if (slug) meta.slug = slug.trim();

        const index = await getIndex();
        index.push(meta);
        await saveIndex(index);
        await setContent(clipId, "");

        return ok({ id: clipId, slug: meta.slug });
      }

      case "PUT": {
        if (!await requireRole(user.email, "admin")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("id" in body) ||
          typeof (body as Record<string, unknown>).id !== "string"
        ) {
          return fail("Invalid body");
        }

        const putData = body as { id: string; name?: string; content?: string; slug?: string; useBase64?: boolean };
        const index = await getIndex();
        const item = index.find((i) => i.id === putData.id);
        if (!item) return fail("Not found");

        const now = new Date().toISOString();

        if (putData.name !== undefined) {
          item.name = putData.name.trim();
        }

        if (putData.slug !== undefined) {
          const trimmedSlug = putData.slug.trim();
          if (trimmedSlug !== "") {
            if (!isValidSlug(trimmedSlug)) {
              return fail("Slug must be alphanumeric (hyphens and underscores allowed)");
            }
            if (index.some((c) => c.slug === trimmedSlug && c.id !== putData.id)) {
              return fail("Slug already in use");
            }
            item.slug = trimmedSlug;
          } else {
            item.slug = undefined;
          }
        }

        if (putData.useBase64 !== undefined) {
          item.useBase64 = putData.useBase64;
        }

        if (putData.content !== undefined) {
          const stored = item.useBase64 !== false ? Buffer.from(putData.content).toString("base64") : putData.content;
          await setContent(item.id, stored);
        }
        item.updatedAt = now;
        await saveIndex(index);

        return ok({ updated: true });
      }

      case "DELETE": {
        if (!await requireRole(user.email, "admin")) return fail("Forbidden");
        let body: unknown;
        try {
          body = (await req.json()) as unknown;
        } catch {
          return fail("Invalid JSON");
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("id" in body) ||
          typeof (body as Record<string, unknown>).id !== "string"
        ) {
          return fail("Invalid body");
        }

        const delId = (body as { id: string }).id;
        const index = await getIndex();
        const idx = index.findIndex((i) => i.id === delId);
        if (idx === -1) return fail("Not found");

        index.splice(idx, 1);
        await saveIndex(index);
        await deleteContent(delId);

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
