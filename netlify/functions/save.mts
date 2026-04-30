import { getStore } from "@netlify/blobs";

export default async (req: Request, context: { clientContext?: { user?: { email?: string; id?: string } } }) => {
  const user = context.clientContext?.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("content" in body) ||
    typeof (body as Record<string, unknown>).content !== "string"
  ) {
    return new Response("Invalid body", { status: 400 });
  }

  const content = (body as { content: string }).content;
  const encoded = Buffer.from(content).toString("base64");

  const store = getStore("keybox");
  await store.set("content", encoded);

  return new Response("Saved", { status: 200 });
};
