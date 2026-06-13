# rawbin → Cloudflare Migration

## Progress

### Phase 0 — Cloudflare Setup  ✅

- [x] Add `rawbin.dpejoh.com` to Cloudflare DNS — **needs user action**
- [x] Add wildcard CNAME `*.rawbin.dpejoh.com` — **needs user action**
- [x] Create D1 database: `rawbin-db`
- [x] `wrangler.toml` with D1 + R2 + assets bindings
- [x] `migrations/001_init.sql`
- [x] Apply D1 migrations (local + remote)
- [x] R2 bucket `rawbin` (reused existing)
- [x] `.github/workflows/deploy.yml` — CI/CD
- [x] Worker deployed at `rawbin.khaledxbz.workers.dev`

### Phase 1 — Auth + Instances ✅

- [x] `src/worker.ts` — Hono app skeleton with CORS, static assets
- [x] `POST /api/auth/register` — create instance + user
- [x] `POST /api/auth/login` — pbkdf2 verify → SignJWT → store session in D1
- [x] `POST /api/auth/logout` — DELETE session
- [x] `GET /api/auth/me` — jwtVerify → return payload
- [x] JWT middleware — verify token, check session in D1
- [x] instance_slug extraction from Host header + query param fallback
- [x] Seed admin instance + admin user (registered via API)
- [x] `useAuth.ts` — rewritten for `/api/auth/*`
- [x] `AuthGate.tsx` — simplified (login + signup with instance_slug)
- [x] Removed `@netlify/identity` from imports (package still in deps)

### Phase 2 — CRUD API Rewrite (partial)

- [x] **Clipboards**: GET/POST/PUT/DELETE `/api/clipboards` + public `/clips/:slug`
- [x] **R2**: `POST /upload/:bucket`, `PUT /upload/:bucket`, `GET /raw/:bucket/:key+`, `DELETE /raw/:bucket/:key+`
- [x] **APKs**: GET/POST/DELETE `/api/apks` (with upsert + R2 delete)
- [x] **Modules**: GET/POST/DELETE `/api/modules` (with upsert + R2 delete)
- [ ] **Catalog** (keybox history): GET/POST/* DELETE `/api/catalog`
- [ ] **Files**: GET/POST/DELETE `/api/files`
- [ ] **Apps**: GET/POST/DELETE `/api/apps`
- [ ] **Roles**: GET/POST/DELETE `/api/roles`
- [ ] **Public keybox raw**: `GET /raw/key/:source/:version` (rate-limited, shuffled)
- [ ] **Rate limiting** on public endpoints (D1 counter)
- [ ] **Content shuffle** on keybox/clipboard raw
- [ ] **`$ref` resolution** in clipboards (D1 cross-table lookup) — `resolveRefs.ts` ported
- [ ] **Certificate serial extraction** in keybox (pure JS ASN.1)

### Phase 3 — Frontend URL Updates

- [ ] Update all hooks: `/.netlify/functions/*` → `/api/*`
- [ ] Update all pages: API URLs
- [ ] `GlobalFab.tsx`: update upload URL
- [ ] `CommandPalette.tsx`: update API URLs
- [ ] `vite.config.ts`: replace Netlify proxy with `localhost:8787`
- [ ] Remove `VITE_R2_WORKER_URL` env var (same origin now)
- [ ] Clean up unused packages: `@netlify/identity`, `@netlify/blobs`, `@netlify/functions`

### Phase 4 — Data Migration

- [ ] `scripts/migrate-blobs.ts`
- [ ] Run migration script
- [ ] Verify all data in D1

### Phase 5 — Cutover

- [ ] Set up DNS: `rawbin.dpejoh.com` → Worker route
- [ ] Set up DNS: `*.rawbin.dpejoh.com` → Worker route
- [ ] `rawbin.netlify.app` → 301 redirect to `rawbin.dpejoh.com`
- [ ] Create user accounts: yuri, tam, etc.
- [ ] Delete old Netlify files
- [ ] Set `JWT_SECRET` env var (secure random)
- [ ] Update README/AGENTS.md

## Files Summary

### New files (Worker system)
| File | Purpose |
|---|---|
| `wrangler.toml` | Worker config: name, main, assets, D1, R2 |
| `src/worker.ts` | Main Hono app — auth routes, sub-router mounting |
| `src/lib/auth.ts` | JWT verification, session management, instance slug extraction |
| `src/lib/shuffle.ts` | Content obfuscation (ported from `_shuffle.mts`) |
| `src/lib/resolveRefs.ts` | `$ref` resolution for clipboards (D1 version) |
| `src/handlers/clipboards.ts` | Clipboards CRUD + public raw endpoint |
| `src/handlers/r2.ts` | R2 upload/download/delete |
| `src/handlers/apks.ts` | APKs CRUD (upsert pattern) |
| `src/handlers/modules.ts` | Modules CRUD (upsert pattern) |
| `migrations/001_init.sql` | D1 schema (10 tables) |
| `.github/workflows/deploy.yml` | CI/CD |

### Modified files
| File | Change |
|---|---|
| `src/hooks/useAuth.ts` | Rewritten — replaced `@netlify/identity` with `fetch('/api/auth/*')` |
| `src/components/AuthGate.tsx` | Simplified to login + signup, added instance_slug field |
| `tsconfig.json` | Excluded `src/worker.ts`, `src/lib`, `src/handlers` |
| `package.json` | Updated scripts, added `hono`, `jose` deps |

### Files to delete (Netlify)
| File | Replaced by |
|---|---|
| `netlify/functions/*` (all 12 files) | Worker handlers |
| `workers/r2-worker/*` | Merged into `src/handlers/r2.ts` |
| `netlify.toml` | `wrangler.toml` |
| `tsconfig.functions.json` | No longer needed |
