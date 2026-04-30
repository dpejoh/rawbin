# Keybox Service — Full Architecture Spec

## Problem Statement

Yuri needs a private, scraper-resistant place to store a keybox as plain text, with a stable raw text URL that a module can fetch programmatically. Existing solutions like GitHub repos are too easy to scrape and index.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere | Strict typing, no `any`, safer serverless functions |
| Frontend | React + MUI | Mature ecosystem, complete Material Design component library |
| Auth | Netlify Identity | Built-in, zero backend config, issues JWTs automatically |
| Backend | Netlify Functions (serverless Node.js) | Co-located with frontend, no separate server |
| Storage | Netlify Blobs | Built-in KV store on Netlify, no external DB, perfect for a single text value |
| Hosting | Netlify | Everything in one place: frontend, functions, identity, blobs |

---

## Project Structure

```
keybox/
├── netlify/
│   └── functions/
│       ├── save.mts              # POST — authenticated, saves content
│       └── raw.mts               # GET — public, returns base64
├── public/
│   └── robots.txt
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── pages/
│       └── Admin.tsx             # The entire editor UI
├── netlify.toml
├── tsconfig.json                 # Frontend config (browser, DOM types)
├── tsconfig.functions.json       # Functions config (Node, ESM/NodeNext)
└── package.json
```

---

## TypeScript Configuration

Two separate tsconfig files are required. Functions run in Node.js and need ESM + Node types. The frontend runs in the browser and needs DOM types. Mixing them causes type conflicts (`document` vs `process`).

### `tsconfig.json` — Frontend

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

### `tsconfig.functions.json` — Netlify Functions

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["netlify/functions"]
}
```

### Strict Rules (non-negotiable)

- `strict: true` everywhere
- `noUncheckedIndexedAccess: true` — array/object access returns `T | undefined`, must be handled
- No `any` — use `unknown` and narrow properly
- All function return types explicitly annotated

---

## Dependencies to Install

```bash
npm install react react-dom @mui/material @mui/icons-material @emotion/react @emotion/styled netlify-identity-widget
npm install -D typescript @types/react @types/react-dom @netlify/functions @netlify/blobs vite @vitejs/plugin-react
```

---

## The Two Serverless Functions

### `raw.mts` — Public Endpoint

- Method: `GET`
- Route: `/.netlify/functions/raw`
- Auth: None — this is intentionally public so the module can fetch it
- Returns: The stored base64 string as `text/plain`
- Defenses:
  - Check `User-Agent` header and block known bot signatures
  - Rate limit by IP using Netlify Blobs (store a counter + timestamp per IP, reset after a window)
  - Respond with `403` for flagged requests

```typescript
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const BLOCKED_AGENTS = ["Googlebot", "bingbot", "Baiduspider", "crawler", "spider", "scraper"];
const RATE_LIMIT = 30; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const ua = event.headers["user-agent"] ?? "";
  if (BLOCKED_AGENTS.some((bot) => ua.toLowerCase().includes(bot.toLowerCase()))) {
    return { statusCode: 403, body: "Forbidden" };
  }

  // Rate limiting logic using Netlify Blobs with IP as key
  // (implement counter + timestamp check here)

  const store = getStore("keybox");
  const value = await store.get("content");

  if (!value) {
    return { statusCode: 404, body: "Not found" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: value,
  };
};

export { handler };
```

### `save.mts` — Protected Endpoint

- Method: `POST`
- Route: `/.netlify/functions/save`
- Auth: Netlify Identity JWT — must be in `Authorization: Bearer <token>` header
- Body: `{ content: string }` — the plain text keybox
- Action: Converts content to base64 with `Buffer.from(content).toString("base64")`, stores in Netlify Blobs
- Returns `200 OK` on success, `401` if no valid JWT, `400` on bad input

```typescript
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

  const body: unknown = JSON.parse(event.body ?? "{}");
  if (typeof body !== "object" || body === null || !("content" in body) || typeof (body as Record<string, unknown>).content !== "string") {
    return { statusCode: 400, body: "Invalid body" };
  }

  const content = (body as { content: string }).content;
  const encoded = Buffer.from(content).toString("base64");

  const store = getStore("keybox");
  await store.set("content", encoded);

  return { statusCode: 200, body: "Saved" };
};

export { handler };
```

> **Note:** `context.clientContext.user` is populated automatically by Netlify when a valid Identity JWT is passed in the `Authorization` header. No manual JWT verification library is needed.

---

## Auth Flow

1. Yuri opens the site
2. `netlify-identity-widget` intercepts — shows login modal if not authenticated
3. On successful login, the widget stores the JWT in localStorage automatically
4. `Admin.tsx` reads the token via `netlify-identity-widget`'s API
5. Every save request attaches `Authorization: Bearer <token>` to the fetch call
6. `save.mts` checks `context.clientContext.user` — if missing or invalid, returns `401`
7. Yuri is the only user — no role system needed. Just having a valid Identity account is the gate. Disable public signups in the Netlify Identity dashboard.

---

## Admin UI — `Admin.tsx`

Single page, no routing needed. Logic:

- If not logged in → Netlify Identity widget handles it
- If logged in → show the editor

Components to use (all MUI):

| Component | Purpose |
|---|---|
| `TextField` multiline | The keybox text editor |
| `Button` | Triggers save |
| `Snackbar` + `Alert` | Success / error feedback |
| `TextField` readonly | Displays the raw URL for copying |
| `IconButton` + `ContentCopy` icon | Copy raw URL to clipboard |

The raw URL to display is hardcoded: `https://your-site.netlify.app/.netlify/functions/raw`

On save:
1. Grab the text from the `TextField`
2. `POST` to `/.netlify/functions/save` with the JWT in headers
3. Show success `Snackbar` on `200`, error `Snackbar` on anything else

---

## Data Flow (End to End)

```
Yuri types plain text keybox into TextField
  → clicks Save
  → Admin.tsx POST /.netlify/functions/save
      headers: { Authorization: Bearer <jwt> }
      body: { content: "<plain text>" }
  → save.mts verifies JWT via context.clientContext.user
  → Buffer.from(content).toString("base64")
  → Netlify Blobs: store.set("content", base64String)
  → 200 OK → Snackbar "Saved"

Module fetches raw link
  → GET /.netlify/functions/raw
  → raw.mts checks User-Agent (no bot) and rate limit
  → store.get("content") from Netlify Blobs
  → responds with base64 string as text/plain
```

---

## Anti-Scraping Strategy

Three layers:

### 1. `public/robots.txt`

```
User-agent: *
Disallow: /
```

### 2. `netlify.toml` — HTTP Headers

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "noindex, nofollow, noarchive, nosnippet"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
```

### 3. `raw.mts` Runtime Defenses

- **User-Agent blocking** — check against a list of known bot signatures and return `403`
- **IP rate limiting** — use Netlify Blobs to track requests per IP per time window
- **Plain text response** — no HTML, no structure, nothing meaningful to scrape. Base64 also breaks naive regex scrapers looking for structured key formats

---

## Key Constraints and Gotchas

1. **Netlify Blobs** requires `@netlify/blobs` and only works fully when deployed on Netlify. For local dev, use `netlify dev` via the Netlify CLI — it emulates Blobs locally.
2. **Disable public signups** in the Netlify Identity dashboard. Yuri is the only user. Invite only.
3. **The raw function must NOT be behind Identity auth** — the module fetching it has no browser session and no JWT.
4. **The raw URL is stable and hardcoded** into whatever module consumes it: `https://your-site.netlify.app/.netlify/functions/raw`
5. **Functions are `.mts` files** (TypeScript ESM). Netlify's build process handles compilation. Make sure `netlify.toml` does not override the functions directory.
6. **`Buffer` is available in Node.js functions** — no import needed. Do not use `btoa()` in functions; it's a browser API. Use `Buffer.from(str).toString("base64")`.
7. **`btoa()` is fine in the browser** (Admin.tsx) but is not needed there since the conversion happens server-side in `save.mts`.

---

## Local Development

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

`netlify dev` runs the Vite dev server and the functions together, and emulates Netlify Identity and Blobs locally.

---

## Deployment Checklist

- [ ] Push repo to GitHub
- [ ] Connect repo to Netlify
- [ ] Enable Netlify Identity in the dashboard
- [ ] Disable public signups, invite Yuri's email
- [ ] Enable Netlify Blobs (on by default for new projects)
- [ ] Set build command: `npm run build`, publish dir: `dist`, functions dir: `netlify/functions`
- [ ] Deploy and confirm `/.netlify/functions/raw` returns the base64 string
- [ ] Hardcode the raw URL into the module that consumes it
