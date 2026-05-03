import { getStore } from "@netlify/blobs";

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

export default async (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await verifyToken(token);
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

  const { content, useBase64, version, source } = body as { content: string; useBase64?: boolean; version?: string; source?: string };
  const shouldEncode = useBase64 !== false;
  const stored = shouldEncode ? Buffer.from(content).toString("base64") : content;

  const store = getStore("keybox");
  await store.set("content", stored);
  await store.set("_meta", JSON.stringify({ useBase64: shouldEncode, version: version ?? "", source: source ?? "" }));

  if (version) {
    try {
      const historyUrl = `${SITE_URL}/.netlify/functions/history/save`;
      await fetch(historyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, version, source: source || "yuri" }),
      });
    } catch {
    }
  }

  return new Response("Saved", { status: 200 });
};
