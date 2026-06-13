CREATE TABLE IF NOT EXISTS invite_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  instance_slug TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'setup',
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (instance_slug) REFERENCES instances(slug) ON DELETE CASCADE
);
