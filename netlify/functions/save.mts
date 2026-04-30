import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const user = context.clientContext?.user;
  if (!user) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "{}") as unknown;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("content" in body) ||
    typeof (body as Record<string, unknown>).content !== "string"
  ) {
    return { statusCode: 400, body: "Invalid body" };
  }

  const content = (body as { content: string }).content;
  const encoded = Buffer.from(content).toString("base64");

  const store = getStore("keybox");
  await store.set("content", encoded);

  return { statusCode: 200, body: "Saved" };
};

export { handler };
