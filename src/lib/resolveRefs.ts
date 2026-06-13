/// <reference types="@cloudflare/workers-types" />

function hasRefPattern(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  if (Array.isArray(data)) return data.some(hasRefPattern);
  if ("$ref" in data) return true;
  return Object.values(data).some(hasRefPattern);
}

async function resolveRef(
  type: string,
  id: string,
  db: D1Database,
  r2WorkerUrl: string,
): Promise<Record<string, unknown> | null> {
  if (type === "apk") {
    const item = await db.prepare(
      "SELECT package_name, app_name, version_code, version_name, size FROM apks WHERE package_name = ?",
    ).bind(id).first<{
      package_name: string;
      app_name: string;
      version_code: number;
      version_name: string;
      size: number;
    }>();
    if (!item) return null;
    return {
      source: "direct",
      url: `${r2WorkerUrl}/raw/apks/${encodeURIComponent(id + ".apk")}`,
      appName: item.app_name,
      versionCode: item.version_code,
      versionName: item.version_name,
      size: item.size,
    };
  }

  if (type === "module") {
    const item = await db.prepare(
      "SELECT module_id, name, version, version_code, size FROM modules WHERE module_id = ?",
    ).bind(id).first<{
      module_id: string;
      name: string;
      version: string;
      version_code: number;
      size: number;
    }>();
    if (!item) return null;
    return {
      source: "direct",
      url: `${r2WorkerUrl}/raw/modules/${encodeURIComponent(id + ".zip")}`,
      name: item.name,
      version: item.version,
      versionCode: item.version_code,
      size: item.size,
    };
  }

  return null;
}

async function walkAndResolve(
  data: unknown,
  db: D1Database,
  r2WorkerUrl: string,
): Promise<unknown> {
  if (typeof data !== "object" || data === null) return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => walkAndResolve(item, db, r2WorkerUrl)));
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj["$ref"] === "string") {
    const ref = obj["$ref"] as string;
    const colonIdx = ref.indexOf(":");
    if (colonIdx !== -1) {
      const type = ref.slice(0, colonIdx);
      const id = ref.slice(colonIdx + 1);
      const resolved = await resolveRef(type, id, db, r2WorkerUrl);
      if (resolved !== null) {
        delete obj["$ref"];
        for (const [key, value] of Object.entries(resolved)) {
          if (!(key in obj)) {
            obj[key] = value;
          }
        }
      } else {
        delete obj["$ref"];
      }
    } else {
      delete obj["$ref"];
    }
  }

  for (const key of Object.keys(obj)) {
    obj[key] = await walkAndResolve(obj[key], db, r2WorkerUrl);
  }

  return obj;
}

export async function resolveRefs(
  decodedJson: string,
  db: D1Database,
  r2WorkerUrl: string,
): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    return null;
  }

  if (!hasRefPattern(parsed)) return null;

  const resolved = await walkAndResolve(parsed, db, r2WorkerUrl);
  return JSON.stringify(resolved);
}
