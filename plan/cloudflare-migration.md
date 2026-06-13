# rawbin → Cloudflare Migration

## Progress

### Phase 0 — Cloudflare Setup ✅
- [x] `wrangler.toml` with D1 + R2 + assets bindings
- [x] `migrations/001_init.sql` — 10 tables
- [x] D1 database `rawbin-db` created + migrated
- [x] R2 bucket `rawbin` (reused)
- [x] Worker deployed at `rawbin.dpejoh.com`
- [x] Routes: `rawbin.dpejoh.com/*`, `*.rawbin.dpejoh.com/*`
- [x] GitHub Actions CI/CD
- [x] No more workers.dev needed

### Phase 1 — Auth + Instances ✅
- [x] `/api/auth/register` — create instance + user (pbkdf2)
- [x] `/api/auth/login` — JWT with D1 session (7-day expiry)
- [x] `/api/auth/logout` — invalidate session
- [x] `/api/auth/me` — verify JWT + session
- [x] Instance slug from hostname (`*.rawbin.dpejoh.com`) or `?instance=` param
- [x] `useAuth.ts` rewritten (no more `@netlify/identity`)
- [x] `AuthGate.tsx` simplified (login + signup)
- [x] Admin user seeded

### Phase 2 — CRUD API Rewrite ✅
- [x] Clipboards: GET/POST/PUT/DELETE + public `/clips/:slug`
- [x] R2: upload/download/delete (`/upload/`, `/raw/`)
- [x] APKs: GET/POST/DELETE with upsert + R2 cleanup
- [x] Modules: GET/POST/DELETE with upsert + R2 cleanup
- [x] Files: GET/POST/DELETE with recursive delete
- [x] Apps: GET/POST/DELETE with search + bulk import
- [x] Roles: GET/POST/DELETE with role validation
- [x] Catalog (keybox): GET/POST/DELETE + save/set-status/auto-override
- [x] Public raw keybox: `/raw/key/:source/:version` with rate limiting
- [x] Content shuffle (ported `_shuffle.mts`)
- [x] `$ref` resolution for clipboards (D1 version)
- [x] Backward compat: `/raw/clips/:slug` redirects to `/clips/:slug`

### Phase 3 — Frontend URL Updates ✅
- [x] All hooks: `/.netlify/functions/*` → `/api/*`
- [x] All pages: API URLs
- [x] R2 upload: `VITE_R2_WORKER_URL/upload/...` → `/upload/...`
- [x] Copy URLs: use `https://rawbin.dpejoh.com/raw/...`
- [x] GlobalFab, CommandPalette, UploadDialog updated
- [x] `vite.config.ts`: proxy to local Worker
- [x] Removed `@netlify/identity`, `@netlify/blobs`, `@netlify/functions`

### Phase 4 — Data Migration
- [ ] Run migration script (needs token from old Netlify session)
- [ ] `scripts/migrate-blobs.ts` → generates `scripts/migrate.sql`
- [ ] `npx wrangler d1 execute rawbin-db --file=scripts/migrate.sql --remote`

### Phase 5 — Cutover
- [ ] Set `JWT_SECRET` secret: `npx wrangler secret put JWT_SECRET`
- [ ] `rawbin.netlify.app` → 301 redirect to `rawbin.dpejoh.com`
- [ ] Delete old Netlify files (`netlify/functions/*`, `workers/r2-worker/*`)
- [ ] Update AGENTS.md

## Architecture

```
rawbin.dpejoh.com / *.rawbin.dpejoh.com
  │
  └── Worker (Hono)
       ├── /api/auth/*      → JWT auth (D1 sessions)
       ├── /api/clipboards  → Clipboards CRUD
       ├── /api/catalog/*   → Keybox history CRUD
       ├── /api/apks        → APKs CRUD
       ├── /api/modules     → Modules CRUD
       ├── /api/files       → Files CRUD
       ├── /api/apps        → App catalog
       ├── /api/roles       → User roles
       ├── /upload/*        → R2 upload
       ├── /raw/*           → R2 download + public clipboards/keybox
       ├── /clips/:slug     → Public clipboard content
       └── /*               → SPA (React from dist/)
           │
      ┌────┴────┐
      D1         R2
   (metadata)  (files)
```
