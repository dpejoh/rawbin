import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { ok, fail, extractToken, verifyRequest, requireRole } from "./_auth.mjs";
import { applyShuffle } from "./_shuffle.mjs";
import { resolveRefs } from "./_resolveRefs.mjs";

const R2_WORKER = process.env.R2_WORKER_URL ?? "http://localhost:8787";

interface ClipboardMeta {
  id: string;
  name: string;
  slug?: string;
  useBase64?: boolean;
  useShuffle?: boolean;
  createdAt: string;
  updatedAt: string;
}

function getStoreInstance() {
  return getStore("clipboards");
}

async function flush(store: ReturnType<typeof getStoreInstance>): Promise<void> {
  await store.get("index");
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
  await flush(store);
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

      let output: string;

      try {
        const decoded = item.useBase64
          ? Buffer.from(content, "base64").toString()
          : content;
        const resolved = await resolveRefs(decoded, R2_WORKER);
        if (resolved !== null) {
          const reEncoded = item.useBase64
            ? Buffer.from(resolved).toString("base64")
            : resolved;
          output = item.useShuffle ? applyShuffle(reEncoded) : reEncoded;
        } else {
          output = item.useShuffle ? applyShuffle(content) : content;
        }
      } catch {
        output = item.useShuffle ? applyShuffle(content) : content;
      }

      return new Response(output, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const token = extractToken(req);
    if (!token) return fail("Unauthorized");
    const auth = await verifyRequest();
    if (!auth) return fail("Unauthorized");

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
        if (!await requireRole(auth.email, "admin", auth.roles)) return fail("Forbidden");
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

        const { name, slug, useBase64: useBase64Post, useShuffle: useShufflePost } = body as { name: string; slug?: string; useBase64?: boolean; useShuffle?: boolean };
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
          useShuffle: useShufflePost === true,
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

        const putData = body as { id: string; name?: string; content?: string; slug?: string; useBase64?: boolean; useShuffle?: boolean };
        const index = await getIndex();
        const item = index.find((i) => i.id === putData.id);
        if (!item) return fail("Not found");

        const isYuriEditor = auth.roles.includes("yuri") && item.slug === "yuri";
        if (isYuriEditor) {
          if (putData.content !== undefined) {
            const stored = item.useBase64 !== false ? Buffer.from(putData.content).toString("base64") : putData.content;
            await setContent(item.id, stored);
          }
          item.updatedAt = new Date().toISOString();
          await saveIndex(index);
          return ok({ updated: true });
        }

        if (!await requireRole(auth.email, "admin", auth.roles)) return fail("Forbidden");

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

        if (putData.useShuffle !== undefined) {
          item.useShuffle = putData.useShuffle;
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
        if (!await requireRole(auth.email, "admin", auth.roles)) return fail("Forbidden");
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
