/**
 * One-shot migration script: reads data from Netlify Blobs stores
 * and inserts into D1.
 *
 * Usage: npx wrangler d1 execute rawbin-db --file=scripts/migrate.sql
 * Or: tsx scripts/migrate-blobs.ts
 *
 * This reads the old Netlify endpoints and generates D1 INSERT statements.
 */

const NETLIFY_BASE = "https://rawbin.netlify.app";
const INSTANCE_SLUG = "admin";

interface OldApk {
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
}

interface OldModule {
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
}

interface OldClipboard {
  id: string;
  name: string;
  slug?: string;
  useBase64?: boolean;
  useShuffle?: boolean;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface OldFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  isFolder: boolean;
  storageKey?: string;
  createdAt: string;
  updatedAt: string;
}

interface OldAppEntry {
  id?: string;
  packageName: string;
  appName: string;
}

interface OldRole {
  email: string;
  role: string;
}

interface OldKeyboxEntry {
  id: string;
  serial: string;
  source: string;
  version: string;
  status: string;
  content?: string;
  autoOverrideSource?: string;
  autoOverrideVersion?: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`  Warning: ${url} returned ${res.status}`);
    return [] as unknown as T;
  }
  return res.json() as Promise<T>;
}

async function migrate() {
  const token = process.env.TOKEN;
  if (!token) {
    console.log(`
Usage: TOKEN="your-jwt" npx tsx scripts/migrate-blobs.ts

Get the token from:
  rawbin.dpejoh.com  →  localStorage.getItem('rawbin:token')
  rawbin.netlify.app →  document.cookie.match(/\\bnf_jwt=([^;]+)/)?.[1]
`);
    process.exit(1);
  }
  const sqlStatements: string[] = [];

  // 1. Migrate APKs
  console.log("\n=== Migrating APKs ===");
  const apks = await fetchJson<OldApk[]>(`${NETLIFY_BASE}/.netlify/functions/apks`, token);
  for (const apk of apks) {
    const storageKey = `${apk.packageName}.apk`;
    sqlStatements.push(`INSERT OR IGNORE INTO apks (id, instance_slug, package_name, app_name, version_code, version_name, min_sdk, target_sdk, size, storage_key, created_at, updated_at) VALUES ('${apk.id}', '${INSTANCE_SLUG}', '${escape(apk.packageName)}', '${escape(apk.appName)}', ${apk.versionCode}, '${escape(apk.versionName)}', ${apk.minSdk}, ${apk.targetSdk}, ${apk.size}, '${escape(storageKey)}', '${apk.createdAt}', '${apk.updatedAt ?? apk.createdAt}');`);
  }
  console.log(`  ${apks.length} APKs`);

  // 2. Migrate Modules
  console.log("=== Migrating Modules ===");
  const modules = await fetchJson<OldModule[]>(`${NETLIFY_BASE}/.netlify/functions/modules`, token);
  for (const mod of modules) {
    const storageKey = `${mod.moduleId}.zip`;
    sqlStatements.push(`INSERT OR IGNORE INTO modules (id, instance_slug, module_id, name, version, version_code, author, description, size, storage_key, created_at, updated_at) VALUES ('${mod.id}', '${INSTANCE_SLUG}', '${escape(mod.moduleId)}', '${escape(mod.name)}', '${escape(mod.version)}', ${mod.versionCode}, '${escape(mod.author)}', '${escape(mod.description)}', ${mod.size}, '${escape(storageKey)}', '${mod.createdAt}', '${mod.updatedAt ?? mod.createdAt}');`);
  }
  console.log(`  ${modules.length} Modules`);

  // 3. Migrate Clipboards
  console.log("=== Migrating Clipboards ===");
  const clipboards = await fetchJson<OldClipboard[]>(`${NETLIFY_BASE}/.netlify/functions/clipboards`, token);
  for (const cb of clipboards) {
    sqlStatements.push(`INSERT OR IGNORE INTO clipboards (id, instance_slug, name, slug, content, use_base64, use_shuffle, created_at, updated_at) VALUES ('${cb.id}', '${INSTANCE_SLUG}', '${escape(cb.name)}', ${cb.slug ? `'${escape(cb.slug)}'` : 'NULL'}, '${escape(cb.content)}', ${cb.useBase64 !== false ? 1 : 0}, ${cb.useShuffle === true ? 1 : 0}, '${cb.createdAt}', '${cb.updatedAt ?? cb.createdAt}');`);
  }
  console.log(`  ${clipboards.length} Clipboards`);

  // 4. Migrate Files
  console.log("=== Migrating Files ===");
  const files = await fetchJson<OldFile[]>(`${NETLIFY_BASE}/.netlify/functions/files`, token);
  for (const file of files) {
    sqlStatements.push(`INSERT OR IGNORE INTO files (id, instance_slug, name, mime_type, size, parent_id, is_folder, storage_key, created_at, updated_at) VALUES ('${file.id}', '${INSTANCE_SLUG}', '${escape(file.name)}', '${escape(file.mimeType)}', ${file.size}, '${escape(file.parentId)}', ${file.isFolder ? 1 : 0}, '${escape(file.storageKey ?? '')}', '${file.createdAt}', '${file.updatedAt ?? file.createdAt}');`);
  }
  console.log(`  ${files.length} Files`);

  // 5. Migrate App Catalog
  console.log("=== Migrating App Catalog ===");
  const appsResp = await fetchJson<Record<string, string>>(`${NETLIFY_BASE}/.netlify/functions/apps`, token);
  if (appsResp && typeof appsResp === "object") {
    // Response is { packageName: appName, ... }
    for (const [packageName, appName] of Object.entries(appsResp)) {
      sqlStatements.push(`INSERT OR IGNORE INTO app_catalog (id, instance_slug, package_name, app_name, created_at) VALUES ('${crypto.randomUUID()}', '${INSTANCE_SLUG}', '${escape(packageName)}', '${escape(appName)}', datetime('now'));`);
    }
    console.log(`  ${Object.keys(appsResp).length} App Catalog entries`);
  }

  // 6. Migrate Roles
  console.log("=== Migrating Roles ===");
  const rolesResp = await fetchJson<{ roles?: Record<string, string> }>(`${NETLIFY_BASE}/.netlify/functions/roles`, token);
  if (rolesResp.roles) {
    for (const [email, role] of Object.entries(rolesResp.roles)) {
      sqlStatements.push(`INSERT OR IGNORE INTO users (email, password_hash, role, instance_slug) VALUES ('${escape(email)}', '', '${escape(role)}', '${INSTANCE_SLUG}');`);
    }
    console.log(`  ${Object.keys(rolesResp.roles).length} Roles`);
  }

  // Write SQL to file
  const fs = await import("fs");
  const output = sqlStatements.join("\n");
  fs.writeFileSync("scripts/migrate.sql", output);
  console.log(`\n✅ Migration SQL written to scripts/migrate.sql (${sqlStatements.length} statements)`);
  console.log("Run: npx wrangler d1 execute rawbin-db --file=scripts/migrate.sql --remote");
}

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

migrate().catch(console.error);
