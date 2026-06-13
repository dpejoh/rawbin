import { getStore } from "@netlify/blobs";

interface ApkMeta {
  id: string;
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  size: number;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

interface ModuleMeta {
  id: string;
  moduleId: string;
  name: string;
  version: string;
  versionCode: number;
  author: string;
  description: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  storage?: string;
}

function hasRefPattern(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  if (Array.isArray(data)) return data.some(hasRefPattern);
  if ('$ref' in data) return true;
  return Object.values(data).some(hasRefPattern);
}

async function resolveRef(
  type: string,
  id: string,
  r2WorkerUrl: string,
): Promise<Record<string, unknown> | null> {
  if (type === 'apk') {
    const store = getStore("apks");
    const raw = await store.get("index");
    if (!raw) return null;
    const index = JSON.parse(raw) as ApkMeta[];
    const item = index.find((a) => a.packageName === id);
    if (!item) return null;
    return {
      source: "direct",
      url: `${r2WorkerUrl}/raw/apks/${encodeURIComponent(id + '.apk')}`,
      appName: item.appName,
      versionCode: item.versionCode,
      versionName: item.versionName,
      size: item.size,
    };
  }

  if (type === 'module') {
    const store = getStore("modules");
    const raw = await store.get("index");
    if (!raw) return null;
    const index = JSON.parse(raw) as ModuleMeta[];
    const item = index.find((m) => m.moduleId === id);
    if (!item) return null;
    return {
      source: "direct",
      url: `${r2WorkerUrl}/raw/modules/${encodeURIComponent(id + '.zip')}`,
      name: item.name,
      version: item.version,
      versionCode: item.versionCode,
      author: item.author,
      description: item.description,
      size: item.size,
    };
  }

  return null;
}

async function walkAndResolve(
  data: unknown,
  r2WorkerUrl: string,
): Promise<unknown> {
  if (typeof data !== 'object' || data === null) return data;

  if (Array.isArray(data)) {
    const resolved = await Promise.all(
      data.map((item) => walkAndResolve(item, r2WorkerUrl)),
    );
    return resolved;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj['$ref'] === 'string') {
    const ref = obj['$ref'] as string;
    const colonIdx = ref.indexOf(':');
    if (colonIdx !== -1) {
      const type = ref.slice(0, colonIdx);
      const id = ref.slice(colonIdx + 1);
      const resolved = await resolveRef(type, id, r2WorkerUrl);
      if (resolved !== null) {
        delete obj['$ref'];
        for (const [key, value] of Object.entries(resolved)) {
          if (!(key in obj)) {
            obj[key] = value;
          }
        }
      } else {
        delete obj['$ref'];
      }
    } else {
      delete obj['$ref'];
    }
  }

  for (const key of Object.keys(obj)) {
    obj[key] = await walkAndResolve(obj[key], r2WorkerUrl);
  }

  return obj;
}

export async function resolveRefs(
  decodedJson: string,
  r2WorkerUrl: string,
): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJson);
  } catch {
    return null;
  }

  if (!hasRefPattern(parsed)) return null;

  const resolved = await walkAndResolve(parsed, r2WorkerUrl);
  return JSON.stringify(resolved);
}
