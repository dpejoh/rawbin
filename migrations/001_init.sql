CREATE TABLE IF NOT EXISTS instances (
  slug TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer',
  instance_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  instance_slug TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS apks (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL DEFAULT '',
  version_code INTEGER NOT NULL DEFAULT 0,
  version_name TEXT NOT NULL DEFAULT '',
  min_sdk INTEGER NOT NULL DEFAULT 0,
  target_sdk INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(instance_slug, package_name),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  module_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  version_code INTEGER NOT NULL DEFAULT 0,
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(instance_slug, module_id),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clipboards (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  content TEXT NOT NULL DEFAULT '',
  use_base64 INTEGER NOT NULL DEFAULT 1,
  use_shuffle INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(instance_slug, slug),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT NOT NULL DEFAULT '',
  is_folder INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_catalog (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(instance_slug, package_name),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS keybox_history (
  id TEXT PRIMARY KEY,
  instance_slug TEXT NOT NULL,
  serial TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  auto_override_source TEXT NOT NULL DEFAULT '',
  auto_override_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resolve_config (
  instance_slug TEXT PRIMARY KEY,
  config TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);
