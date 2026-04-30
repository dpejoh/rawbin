# Yuribin → MDUI v2 Full Rewrite

## What Stays Unchanged

These files have zero UI dependencies and require no edits:

- `src/hooks/useAuth.ts`
- `src/hooks/useClipboards.ts`
- `src/hooks/useKeybox.ts` *(still unused by Keybox.tsx — see Step 12)*
- `netlify/` directory
- `tsconfig.json`, `vite.config.ts`, `netlify.toml`
- `public/`

---

## Step 1 — Packages

```bash
npm uninstall @emotion/react @emotion/styled @mui/icons-material @mui/lab @mui/material notistack
npm install mdui
```

`package.json` dependencies after:

```json
{
  "dependencies": {
    "@fontsource/geist-mono": "^5.1.0",
    "mdui": "^2.1.4",
    "netlify-identity-widget": "^1.9.2",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

Delete `src/theme/theme.ts` and `src/components/SnackbarProvider.tsx` — both are fully replaced.

---

## Step 2 — `index.html`

Add `viewport-fit=cover` for notched devices. No other changes needed — MDUI loads via npm imports in `main.tsx`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="color-scheme" content="dark light" />
    <title>Keybox</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Step 3 — `src/mdui.d.ts` (new file)

Teaches TypeScript + React's JSX namespace about every MDUI element used in this project.

```typescript
/// <reference types="react" />

type H = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'mdui-layout':                  H;
      'mdui-layout-main':             H;
      'mdui-navigation-rail':         H & { value?: string; 'label-visibility'?: string };
      'mdui-navigation-rail-item':    H & { value?: string; icon?: string; 'active-icon'?: string };
      'mdui-navigation-bar':          H & { value?: string; 'label-visibility'?: string };
      'mdui-navigation-bar-item':     H & { value?: string; icon?: string; 'active-icon'?: string };
      'mdui-button': H & {
        variant?: 'elevated' | 'filled' | 'tonal' | 'outlined' | 'text';
        icon?: string;
        'end-icon'?: string;
        href?: string;
        disabled?: boolean;
        'full-width'?: boolean;
      };
      'mdui-button-icon': H & { icon?: string; href?: string; disabled?: boolean };
      'mdui-card': H & { variant?: 'elevated' | 'filled' | 'outlined'; clickable?: boolean };
      'mdui-text-field': H & {
        variant?: 'outlined' | 'filled';
        label?: string;
        placeholder?: string;
        rows?: number;
        'min-rows'?: number;
        'max-rows'?: number;
        multiline?: boolean;
        type?: string;
        disabled?: boolean;
        readonly?: boolean;
        clearable?: boolean;
        helper?: string;
      };
      'mdui-dialog': H & {
        headline?: string;
        'close-on-overlay-click'?: boolean;
        'close-on-esc'?: boolean;
        icon?: string;
      };
      'mdui-list':      H;
      'mdui-list-item': H & {
        icon?: string;
        'active-icon'?: string;
        rounded?: boolean;
        disabled?: boolean;
        nonclickable?: boolean;
        href?: string;
      };
      'mdui-divider':   H & { inset?: boolean; middle?: boolean };
      'mdui-chip': H & {
        variant?: 'assist' | 'filter' | 'input' | 'suggestion';
        icon?: string;
        selectable?: boolean;
        selected?: boolean;
        elevated?: boolean;
        disabled?: boolean;
      };
      'mdui-switch':              H & { checked?: boolean; disabled?: boolean };
      'mdui-circular-progress':   H & { value?: number };
      'mdui-linear-progress':     H & { value?: number };
      'mdui-icon':                H & { name?: string };
      'mdui-avatar':              H & { src?: string; label?: string };
      'mdui-tooltip':             H & { content?: string; placement?: string };
      'mdui-dropdown': H & {
        trigger?: string;
        placement?: string;
        disabled?: boolean;
        open?: boolean;
      };
      'mdui-menu':      H & { selects?: string; value?: string };
      'mdui-menu-item': H & {
        value?: string;
        icon?: string;
        'active-icon'?: string;
        disabled?: boolean;
        href?: string;
      };
      'mdui-breadcrumb':      H;
      'mdui-breadcrumb-item': H & { href?: string; separator?: string };
    }
  }
}
```

---

## Step 4 — `src/utils/time.ts` (new file)

Fixes the duplicate `relativeTime` + `formatSize` that existed in both `ClipboardList.tsx` and `Files/index.tsx`.

```typescript
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

---

## Step 5 — `src/utils/upload.ts` (new file)

Fixes the blocking main-thread base64 encoding bug. The original used a synchronous
`for` loop over every byte of the ArrayBuffer on the main thread, which freezes the UI
for files larger than ~1 MB. `FileReader.readAsDataURL` runs off the main thread.

```typescript
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:<mime>;base64,<data>" — we only want the data part
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}
```

---

## Step 6 — `src/hooks/useMdui.ts` (new file)

React 18 does not propagate custom web component events through its synthetic event
system, and does not set boolean web component properties — it stringifies them.
This hook file covers every MDUI integration pattern used in this project.

```typescript
import { useRef, useEffect, useCallback } from 'react';

type Ref<T = any> = React.RefObject<T>;

/**
 * Controlled text input for mdui-text-field.
 * Sets `value` as a DOM property and listens to the native `input` event.
 */
export function useMduiInput(
  value: string,
  onChange: (v: string) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.value === value) return;
    el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value ?? '');
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onChange]);

  return ref;
}

/**
 * Controlled dialog.
 * Sets `open` as a DOM property; listens for the MDUI `close` custom event.
 */
export function useMduiDialog(open: boolean, onClose?: () => void): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.open = open;
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClose) return;
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, [onClose]);

  return ref;
}

/**
 * Controlled mdui-switch.
 * Sets `checked` as a DOM property; listens for the `change` custom event.
 */
export function useMduiSwitch(
  checked: boolean,
  onChange: (v: boolean) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.checked = checked;
  }, [checked]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(Boolean(el.checked));
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return ref;
}

/**
 * Controlled navigation rail or bar.
 * Sets `value` as a DOM property; listens for the `change` custom event.
 */
export function useMduiNav(
  value: string,
  onChange: (v: string) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value ?? '');
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return ref;
}

/**
 * Sets arbitrary DOM properties on an MDUI element after every render.
 * Use for boolean properties like `loading` and `disabled` that React
 * would otherwise stringify.
 */
export function useMduiProps(props: Record<string, unknown>): Ref {
  const ref = useRef<any>(null);
  // Run after every render — intentionally no dep array
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of Object.entries(props)) el[k] = v;
  });
  return ref;
}
```

---

## Step 7 — `src/hooks/useBreakpoint.ts` (new file)

Replaces MUI's `useMediaQuery`. Single source of truth for the mobile breakpoint — fixes
the 599 px vs 899 px conflict that caused NavRail to show on desktop while ClipboardEditor
rendered in mobile mode.

```typescript
import { useState, useEffect } from 'react';

const MOBILE_MQL = '(max-width: 599px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_MQL).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MQL);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
```

---

## Step 8 — `src/styles/app.css` (new file)

```css
/* ─── Font ─────────────────────────────────────────────────────────────── */
body {
  margin: 0;
  font-family: 'Geist Mono', monospace;
}

/* Propagate Geist Mono through all MDUI typescale levels */
:root {
  --mdui-typescale-display-large-font-family:   'Geist Mono', monospace;
  --mdui-typescale-display-medium-font-family:  'Geist Mono', monospace;
  --mdui-typescale-display-small-font-family:   'Geist Mono', monospace;
  --mdui-typescale-headline-large-font-family:  'Geist Mono', monospace;
  --mdui-typescale-headline-medium-font-family: 'Geist Mono', monospace;
  --mdui-typescale-headline-small-font-family:  'Geist Mono', monospace;
  --mdui-typescale-title-large-font-family:     'Geist Mono', monospace;
  --mdui-typescale-title-medium-font-family:    'Geist Mono', monospace;
  --mdui-typescale-title-small-font-family:     'Geist Mono', monospace;
  --mdui-typescale-label-large-font-family:     'Geist Mono', monospace;
  --mdui-typescale-label-medium-font-family:    'Geist Mono', monospace;
  --mdui-typescale-label-small-font-family:     'Geist Mono', monospace;
  --mdui-typescale-body-large-font-family:      'Geist Mono', monospace;
  --mdui-typescale-body-medium-font-family:     'Geist Mono', monospace;
  --mdui-typescale-body-small-font-family:      'Geist Mono', monospace;
}

/* ─── Layout ────────────────────────────────────────────────────────────── */
mdui-layout {
  height: 100vh;
}

mdui-layout-main {
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* Single breakpoint 600 px — one constant, not two competing values */
@media (max-width: 599px) {
  mdui-navigation-rail { display: none; }
  .desktop-only { display: none !important; }
}

@media (min-width: 600px) {
  mdui-navigation-bar { display: none; }
  .mobile-only { display: none !important; }
  /* Mobile bottom padding not needed on desktop */
  .mobile-pb { padding-bottom: 0 !important; }
}

/* Bottom padding equal to mdui-navigation-bar height (80 px) */
.mobile-pb {
  padding-bottom: 80px;
}

/* ─── Auth / loading screens ────────────────────────────────────────────── */
.auth-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 16px;
  padding: 24px;
  box-sizing: border-box;
  background: var(--mdui-color-surface);
  text-align: center;
}

/* ─── Navigation rail footer (avatar) ───────────────────────────────────── */
.nav-footer {
  padding: 12px;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--mdui-color-outline-variant);
}

/* ─── Page wrappers ─────────────────────────────────────────────────────── */
.page {
  padding: 32px;
  max-width: 800px;
  box-sizing: border-box;
}

.page-fill {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ─── Inline metadata rows ──────────────────────────────────────────────── */
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ─── Raw URL strip ─────────────────────────────────────────────────────── */
.raw-url-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--mdui-color-surface-container);
  border-radius: var(--mdui-shape-corner-extra-small);
  padding: 8px 12px;
}

.raw-url-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Geist Mono', monospace;
  font-size: 13px;
  color: var(--mdui-color-on-surface);
}

/* ─── Unsaved indicator ──────────────────────────────────────────────────── */
.unsaved-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mdui-color-primary);
  display: inline-block;
  flex-shrink: 0;
}

/* ─── Save row ────────────────────────────────────────────────────────────── */
.save-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.save-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ─── Clipboard list panel ───────────────────────────────────────────────── */
.clipboard-panel {
  width: 320px;
  min-width: 320px;
  background: var(--mdui-color-surface-container);
  height: 100%;
  overflow-y: auto;
  flex-shrink: 0;
}

/* ─── File rows ──────────────────────────────────────────────────────────── */
.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--mdui-shape-corner-small);
  background: var(--mdui-color-surface-container);
  transition: background 150ms;
}

.file-row:hover {
  background: var(--mdui-color-surface-container-high);
}

.file-row--folder {
  cursor: pointer;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Drag-and-drop overlay ──────────────────────────────────────────────── */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 999;
  /* Uses M3 surface with alpha — replaces the hardcoded rgba(17,19,24,0.85) */
  background: color-mix(in srgb, var(--mdui-color-surface) 85%, transparent);
  border: 2px dashed var(--mdui-color-primary);
  border-radius: var(--mdui-shape-corner-medium);
  margin: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* ─── Upload dropzone ────────────────────────────────────────────────────── */
.upload-dropzone {
  border: 1px dashed var(--mdui-color-outline);
  border-radius: var(--mdui-shape-corner-medium);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 150ms;
}

.upload-dropzone:hover {
  background: var(--mdui-color-surface-container);
}

/* ─── Empty states ───────────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 16px;
  padding: 64px 24px;
  text-align: center;
}

/* ─── Section label (used in dialogs etc.) ───────────────────────────────── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

/* ─── Upload mode toggle ─────────────────────────────────────────────────── */
.mode-toggle {
  display: flex;
  gap: 8px;
}
```

---

## Step 9 — `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import 'mdui/mdui.css';
import 'mdui';
import './styles/app.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

## Step 10 — `src/App.tsx`

No more `ThemeProvider`, `CssBaseline`, or `SnackbarProvider`. MDUI is initialised with
`setTheme` and `setColorScheme` in a one-time effect. CSS handles which nav component is
visible — removing all `useMediaQuery` from this file entirely.

```tsx
import { useState, useCallback, useMemo, useEffect } from 'react';
import { setTheme, setColorScheme } from 'mdui';
import { useMduiNav } from './hooks/useMdui';
import NavRail from './components/NavRail';
import Keybox from './pages/Keybox';
import ClipboardsPage from './pages/Clipboards';
import FilesPage from './pages/Files';
import useAuth from './hooks/useAuth';

export type Page = 'keybox' | 'clipboards' | 'files';

export default function App() {
  const { user, token, isLoading, signOut } = useAuth();
  const [page, setPage] = useState<Page>('keybox');

  // Initialise MDUI theme once on mount
  useEffect(() => {
    setTheme('dark');
    // Seed color generates the full M3 dynamic palette
    setColorScheme('#1B6EF3');
  }, []);

  const handleNavigate = useCallback((p: string) => setPage(p as Page), []);

  const railRef = useMduiNav(page, handleNavigate);
  const barRef  = useMduiNav(page, handleNavigate);

  const userInitials = useMemo(
    () => (user?.email ? (user.email[0]?.toUpperCase() ?? '?') : '?'),
    [user],
  );

  if (isLoading) {
    return (
      <div className="auth-screen">
        <mdui-circular-progress />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <mdui-icon name="lock_open" style={{ fontSize: 48, color: 'var(--mdui-color-outline)' }} />
        <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>
          Sign in to Keybox
        </p>
        <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
          Authenticate with your Netlify Identity account to continue.
        </p>
        {/* Netlify Identity opens its own modal on init when no user exists */}
      </div>
    );
  }

  return (
    <mdui-layout>

      {/* Desktop: Navigation Rail — hidden on mobile via CSS */}
      <NavRail
        navRef={railRef}
        userInitials={userInitials}
        onSignOut={signOut}
      />

      <mdui-layout-main>
        <div className="mobile-pb" style={{ flex: 1, overflow: 'auto' }}>
          {page === 'keybox'      && <Keybox token={token} />}
          {page === 'clipboards'  && <ClipboardsPage token={token} />}
          {page === 'files'       && <FilesPage token={token} />}
        </div>
      </mdui-layout-main>

      {/* Mobile: Navigation Bar — hidden on desktop via CSS */}
      <mdui-navigation-bar ref={barRef} label-visibility="selected">
        <mdui-navigation-bar-item
          icon="vpn_key--outlined"
          active-icon="vpn_key"
          value="keybox"
        >
          Keybox
        </mdui-navigation-bar-item>
        <mdui-navigation-bar-item
          icon="content_paste--outlined"
          active-icon="content_paste"
          value="clipboards"
        >
          Boards
        </mdui-navigation-bar-item>
        <mdui-navigation-bar-item
          icon="folder--outlined"
          active-icon="folder"
          value="files"
        >
          Files
        </mdui-navigation-bar-item>
      </mdui-navigation-bar>

    </mdui-layout>
  );
}
```

---

## Step 11 — `src/components/NavRail.tsx`

The original NavRail built a custom layout from `Stack` + `IconButton` and hardcoded
`#0842A0` five times as the on-primary colour. This version uses `mdui-navigation-rail`
with M3 indicator semantics and `var(--mdui-color-on-primary)` for everything that sits
on top of the primary container.

```tsx
import type { RefObject } from 'react';

interface NavRailProps {
  navRef: RefObject<any>;
  userInitials: string;
  onSignOut: () => void;
}

export default function NavRail({ navRef, userInitials, onSignOut }: NavRailProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <mdui-navigation-rail
        ref={navRef}
        label-visibility="selected"
        style={{ flex: 1 }}
      >
        {/* App logo above items */}
        <mdui-icon
          slot="header"
          name="key"
          style={{
            fontSize: 28,
            color: 'var(--mdui-color-primary)',
            padding: '12px 0 20px',
            display: 'block',
            textAlign: 'center',
          }}
        />

        <mdui-navigation-rail-item
          icon="vpn_key--outlined"
          active-icon="vpn_key"
          value="keybox"
        >
          Keybox
        </mdui-navigation-rail-item>

        <mdui-navigation-rail-item
          icon="content_paste--outlined"
          active-icon="content_paste"
          value="clipboards"
        >
          Boards
        </mdui-navigation-rail-item>

        <mdui-navigation-rail-item
          icon="folder--outlined"
          active-icon="folder"
          value="files"
        >
          Files
        </mdui-navigation-rail-item>
      </mdui-navigation-rail>

      {/* User avatar + sign-out menu */}
      <div className="nav-footer">
        <mdui-dropdown placement="right-end">
          <mdui-avatar
            slot="trigger"
            style={{ cursor: 'pointer', fontSize: '14px' }}
          >
            {userInitials}
          </mdui-avatar>
          <mdui-menu>
            <mdui-menu-item icon="logout" onClick={onSignOut}>
              Sign out
            </mdui-menu-item>
          </mdui-menu>
        </mdui-dropdown>
      </div>
    </div>
  );
}
```

`BottomNav.tsx` is deleted — its JSX is now inlined in `App.tsx`.

---

## Step 12 — `src/components/RawUrlRow.tsx`

```tsx
import { useState, useCallback } from 'react';
import { snackbar } from 'mdui';

interface RawUrlRowProps {
  url: string;
}

export default function RawUrlRow({ url }: RawUrlRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      snackbar({ message: 'Raw URL copied', placement: 'bottom', autoCloseDelay: 2000 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2000 });
    }
  }, [url]);

  return (
    <div className="raw-url-strip">
      <span className="raw-url-text">{url}</span>
      <mdui-tooltip content="Copy raw URL">
        <mdui-button-icon
          icon={copied ? 'check' : 'content_copy'}
          onClick={handleCopy}
          style={copied ? { color: 'var(--mdui-color-primary)' } : undefined}
        />
      </mdui-tooltip>
    </div>
  );
}
```

---

## Step 13 — `src/components/SaveButton.tsx`

Uses `useMduiProps` to set `loading` and `disabled` as DOM properties (not HTML
attributes), which is required for MDUI web components in React 18.

```tsx
import { useMduiProps } from '../hooks/useMdui';

interface SaveButtonProps {
  loading: boolean;
  hasUnsaved: boolean;
  onSave: () => void;
}

export default function SaveButton({ loading, hasUnsaved, onSave }: SaveButtonProps) {
  const btnRef = useMduiProps({ loading, disabled: !hasUnsaved });

  return (
    <div className="save-actions">
      {hasUnsaved && <span className="unsaved-dot" />}
      <mdui-button ref={btnRef} variant="tonal" onClick={onSave}>
        Save
      </mdui-button>
    </div>
  );
}
```

---

## Step 14 — `src/pages/Keybox.tsx`

The existing `useKeybox` hook was unused — `Keybox.tsx` had its own inline state
management that supported `useBase64` which the hook omitted. The inline approach is
kept and migrated to MDUI.

```tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { snackbar } from 'mdui';
import { useMduiInput, useMduiSwitch } from '../../hooks/useMdui';
import RawUrlRow from '../components/RawUrlRow';
import SaveButton from '../components/SaveButton';

interface KeyboxProps {
  token: string | null;
}

const RAW_URL = `${window.location.origin}/key`;

export default function Keybox({ token }: KeyboxProps) {
  const [content,      setContent]      = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [useBase64,    setUseBase64]    = useState(true);
  const [savedBase64,  setSavedBase64]  = useState(true);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);

  const contentRef  = useMduiInput(content, setContent);
  const switchRef   = useMduiSwitch(useBase64, setUseBase64);

  useEffect(() => {
    async function load() {
      try {
        const [contentRes, metaRes] = await Promise.all([
          fetch(RAW_URL),
          fetch(`${RAW_URL}?meta`),
        ]);
        if (contentRes.ok) {
          const text = await contentRes.text();
          let meta = { useBase64: true };
          try {
            if (metaRes.ok) meta = JSON.parse(await metaRes.text()) as { useBase64: boolean };
          } catch { /* ignore */ }
          const decoded = meta.useBase64 ? atob(text) : text;
          setContent(decoded);
          setSavedContent(decoded);
          setUseBase64(meta.useBase64);
          setSavedBase64(meta.useBase64);
        }
      } catch { /* no content yet */ }
      finally { setIsLoading(false); }
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch('/.netlify/functions/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, useBase64 }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedBase64(useBase64);
        snackbar({ message: 'Keybox saved', placement: 'bottom', autoCloseDelay: 2500 });
      } else {
        snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
      }
    } catch {
      snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, [token, content, useBase64]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64],
  );

  const charCount = useMemo(() => content.length.toLocaleString(), [content]);

  return (
    <div className="page">
      <div style={{ marginBottom: 24 }}>
        <p className="mdui-typescale-headline-medium" style={{ margin: '0 0 4px' }}>
          Keybox
        </p>
        <p
          className="mdui-typescale-body-medium"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          Your private keybox.{' '}
          {useBase64 ? 'Stored as base64.' : 'Stored as plain text.'}
        </p>
      </div>

      <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block' }}>
        <p
          className="mdui-typescale-label-small"
          style={{ margin: '0 0 6px', color: 'var(--mdui-color-outline)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Raw URL
        </p>
        <RawUrlRow url={RAW_URL} />
      </mdui-card>

      <mdui-card variant="filled" style={{ padding: 16, marginBottom: 16, display: 'block' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[288, 24, 24].map((h, i) => (
              <mdui-skeleton
                key={i}
                style={{
                  height: h,
                  borderRadius: 'var(--mdui-shape-corner-extra-small)',
                  display: 'block',
                }}
              />
            ))}
          </div>
        ) : (
          <mdui-text-field
            ref={contentRef}
            variant="outlined"
            multiline
            min-rows={12}
            placeholder="Paste your keybox here…"
            style={{ width: '100%', fontFamily: "'Geist Mono', monospace" }}
          />
        )}
      </mdui-card>

      <div className="save-row">
        <p
          className="mdui-typescale-body-small"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          {charCount} characters
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <mdui-switch ref={switchRef} />
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              Base64
            </span>
          </label>
          <SaveButton
            loading={isSaving}
            hasUnsaved={hasUnsaved}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 15 — `src/pages/Clipboards/ClipboardList.tsx`

Fixes:
- Hardcoded `#0842A0` replaced with `var(--mdui-color-on-primary-container)`
- `relativeTime` imported from shared util
- `mdui-dropdown` for the context menu — click on the trigger is wrapped in a div that
  stops propagation, preventing the list item select from firing simultaneously

```tsx
import { useCallback, useState } from 'react';
import { relativeTime } from '../../utils/time';
import { snackbar } from 'mdui';
import type { Clipboard } from '../../hooks/useClipboards';

interface ClipboardListProps {
  clipboards: Clipboard[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onCopyUrl: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ClipboardList({
  clipboards,
  selectedId,
  isLoading,
  onSelect,
  onRename,
  onCopyUrl,
  onDelete,
}: ClipboardListProps) {
  if (isLoading) {
    return (
      <div className="clipboard-panel" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mdui-skeleton
            key={i}
            style={{
              height: 64,
              borderRadius: 'var(--mdui-shape-corner-small)',
              display: 'block',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="clipboard-panel">
      <mdui-list>
        {clipboards.map((cb) => {
          const isActive = cb.id === selectedId;
          return (
            <mdui-list-item
              key={cb.id}
              icon="description"
              rounded
              onClick={() => onSelect(cb.id)}
              style={
                isActive
                  ? {
                      // M3 selection uses primary-container, not raw primary
                      background: 'var(--mdui-color-primary-container)',
                      color: 'var(--mdui-color-on-primary-container)',
                    }
                  : undefined
              }
            >
              {cb.name}
              <span slot="description">
                {relativeTime(cb.updatedAt)} · {cb.content.length.toLocaleString()} chars
              </span>

              {/* Stop propagation so the dropdown click doesn't also trigger onSelect */}
              <div slot="end-icon" onClick={(e) => e.stopPropagation()}>
                <mdui-dropdown trigger="click" placement="bottom-end">
                  <mdui-button-icon
                    slot="trigger"
                    icon="more_vert"
                    style={{ color: 'var(--mdui-color-on-surface-variant)' }}
                  />
                  <mdui-menu>
                    <mdui-menu-item
                      icon="drive_file_rename_outline"
                      onClick={() => onRename(cb.id)}
                    >
                      Rename
                    </mdui-menu-item>
                    <mdui-menu-item
                      icon="link"
                      onClick={() => onCopyUrl(cb.id)}
                    >
                      Copy raw URL
                    </mdui-menu-item>
                    <mdui-divider />
                    <mdui-menu-item
                      icon="delete_outline"
                      onClick={() => onDelete(cb.id)}
                      style={{ color: 'var(--mdui-color-error)' }}
                    >
                      Delete
                    </mdui-menu-item>
                  </mdui-menu>
                </mdui-dropdown>
              </div>
            </mdui-list-item>
          );
        })}
      </mdui-list>
    </div>
  );
}
```

---

## Step 16 — `src/pages/Clipboards/ClipboardEditor.tsx`

Hardcoded `#0842A0` removed. `useMduiInput` and `useMduiSwitch` replace the old inline
state-to-DOM sync.

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { snackbar } from 'mdui';
import { useMduiInput, useMduiSwitch } from '../../hooks/useMdui';
import RawUrlRow from '../../components/RawUrlRow';
import SaveButton from '../../components/SaveButton';
import type { Clipboard } from '../../hooks/useClipboards';

function clipboardUrl(id: string, slug?: string): string {
  return `${window.location.origin}${slug ? `/clips/${slug}` : `/clips/${id}`}`;
}

function decodeContent(raw: string, useBase64: boolean): string {
  if (!useBase64) return raw;
  try { return atob(raw); } catch { return raw; }
}

function encodeContent(raw: string, useBase64: boolean): string {
  return useBase64 ? btoa(raw) : raw;
}

interface ClipboardEditorProps {
  clipboard: Clipboard;
  token: string | null;
  onUpdate: (
    token: string,
    id: string,
    data: { name?: string; content?: string; slug?: string; useBase64?: boolean },
  ) => Promise<boolean>;
}

export default function ClipboardEditor({
  clipboard,
  token,
  onUpdate,
}: ClipboardEditorProps) {
  const initialDecoded = useMemo(
    () => decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipboard.id],
  );

  const [content,      setContent]      = useState(initialDecoded);
  const [useBase64,    setUseBase64]    = useState(clipboard.useBase64 !== false);
  const [savedContent, setSavedContent] = useState(initialDecoded);
  const [savedBase64,  setSavedBase64]  = useState(clipboard.useBase64 !== false);
  const [name,         setName]         = useState(clipboard.name);
  const [savedName,    setSavedName]    = useState(clipboard.name);
  const [slug,         setSlug]         = useState(clipboard.slug ?? '');
  const [savedSlug,    setSavedSlug]    = useState(clipboard.slug ?? '');
  const [editingName,  setEditingName]  = useState(false);
  const [editingSlug,  setEditingSlug]  = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  const contentRef  = useMduiInput(content, setContent);
  const nameRef     = useMduiInput(name, setName);
  const slugRef     = useMduiInput(slug, setSlug);
  const switchRef   = useMduiSwitch(useBase64, setUseBase64);

  useEffect(() => {
    const decoded = decodeContent(clipboard.content ?? '', clipboard.useBase64 !== false);
    setContent(decoded);       setSavedContent(decoded);
    setUseBase64(clipboard.useBase64 !== false);
    setSavedBase64(clipboard.useBase64 !== false);
    setName(clipboard.name);   setSavedName(clipboard.name);
    setSlug(clipboard.slug ?? '');
    setSavedSlug(clipboard.slug ?? '');
  }, [clipboard.id, clipboard.content, clipboard.name, clipboard.slug, clipboard.useBase64]);

  const saveName = useCallback(async () => {
    if (!token || name === savedName) { setEditingName(false); return; }
    const ok = await onUpdate(token, clipboard.id, { name });
    if (ok) { setSavedName(name); snackbar({ message: 'Renamed', placement: 'bottom', autoCloseDelay: 2000 }); }
    else snackbar({ message: 'Failed to rename', placement: 'bottom', autoCloseDelay: 3000 });
    setEditingName(false);
  }, [token, name, savedName, clipboard.id, onUpdate]);

  const saveSlug = useCallback(async () => {
    if (!token || slug === savedSlug) { setEditingSlug(false); return; }
    const ok = await onUpdate(token, clipboard.id, { slug: slug || undefined });
    if (ok) { setSavedSlug(slug); snackbar({ message: 'Custom URL updated', placement: 'bottom', autoCloseDelay: 2000 }); }
    else snackbar({ message: 'Failed to update URL', placement: 'bottom', autoCloseDelay: 3000 });
    setEditingSlug(false);
  }, [token, slug, savedSlug, clipboard.id, onUpdate]);

  const saveContent = useCallback(async () => {
    if (!token) return;
    setIsSaving(true);
    const stored = encodeContent(content, useBase64);
    const ok = await onUpdate(token, clipboard.id, { content: stored, useBase64 });
    if (ok) {
      setSavedContent(content);
      setSavedBase64(useBase64);
      snackbar({ message: 'Saved', placement: 'bottom', autoCloseDelay: 2000 });
    } else {
      snackbar({ message: 'Failed to save. Try again.', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsSaving(false);
  }, [token, content, useBase64, clipboard.id, onUpdate]);

  const hasUnsaved = useMemo(
    () => content !== savedContent || useBase64 !== savedBase64,
    [content, savedContent, useBase64, savedBase64],
  );

  const rawUrl      = clipboardUrl(clipboard.id, savedSlug || undefined);
  const canonicalUrl = clipboardUrl(clipboard.id);

  return (
    <div className="page" style={{ flex: 1, overflow: 'auto' }}>
      {/* Editable name */}
      <div style={{ marginBottom: 24 }}>
        {editingName ? (
          <mdui-text-field
            ref={nameRef}
            variant="outlined"
            autoFocus
            onBlur={saveName}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setName(savedName); setEditingName(false); }
            }}
            style={{ width: '100%' }}
          />
        ) : (
          <p
            className="mdui-typescale-headline-small"
            style={{ margin: 0, cursor: 'pointer', color: 'var(--mdui-color-on-surface)' }}
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {name}
          </p>
        )}
      </div>

      <RawUrlRow url={rawUrl} />

      {savedSlug && canonicalUrl !== rawUrl && (
        <p
          className="mdui-typescale-body-small"
          style={{ margin: '8px 0 0', color: 'var(--mdui-color-on-surface-variant)' }}
        >
          Also at: {canonicalUrl}
        </p>
      )}

      {/* Editable slug */}
      <div className="meta-row" style={{ marginTop: 12, marginBottom: 16 }}>
        <span
          className="mdui-typescale-body-small"
          style={{ color: 'var(--mdui-color-on-surface-variant)', whiteSpace: 'nowrap' }}
        >
          Custom URL: /clips/
        </span>
        {editingSlug ? (
          <mdui-text-field
            ref={slugRef}
            variant="outlined"
            placeholder="custom-slug"
            style={{ width: 200 }}
            onBlur={saveSlug}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') saveSlug();
              if (e.key === 'Escape') { setSlug(savedSlug); setEditingSlug(false); }
            }}
          />
        ) : (
          <span
            className="mdui-typescale-body-small"
            style={{
              cursor: 'pointer',
              color: slug ? 'var(--mdui-color-primary)' : 'var(--mdui-color-on-surface-variant)',
              fontFamily: "'Geist Mono', monospace",
            }}
            onClick={() => setEditingSlug(true)}
          >
            {slug || 'set custom URL…'}
          </span>
        )}
      </div>

      <mdui-text-field
        ref={contentRef}
        variant="outlined"
        multiline
        min-rows={10}
        placeholder="Start typing…"
        style={{ width: '100%', marginBottom: 16 }}
      />

      <div className="save-row">
        <p
          className="mdui-typescale-body-small"
          style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
        >
          {content.length.toLocaleString()} characters
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <mdui-switch ref={switchRef} />
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              Base64
            </span>
          </label>
          <SaveButton loading={isSaving} hasUnsaved={hasUnsaved} onSave={saveContent} />
        </div>
      </div>
    </div>
  );
}
```

---

## Step 17 — `src/pages/Clipboards/CreateDialog.tsx`

```tsx
import { useState, useCallback } from 'react';
import { useMduiDialog, useMduiInput } from '../../hooks/useMdui';

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, slug?: string) => Promise<void>;
}

export default function CreateDialog({ open, onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const dialogRef = useMduiDialog(open, onClose);
  const nameRef   = useMduiInput(name, setName);
  const slugRef   = useMduiInput(slug, setSlug);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed, slug.trim() || undefined);
    setName('');
    setSlug('');
    onClose();
  }, [name, slug, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    setSlug('');
    onClose();
  }, [onClose]);

  return (
    <mdui-dialog
      ref={dialogRef}
      headline="New Clipboard"
      close-on-overlay-click
      close-on-esc
    >
      <div className="field-group">
        <mdui-text-field
          ref={nameRef}
          variant="outlined"
          label="Name"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <mdui-text-field
          ref={slugRef}
          variant="outlined"
          label="Custom URL (optional)"
          placeholder="my-custom-link"
          helper="Alphanumeric, hyphens, underscores"
        />
      </div>

      <mdui-button slot="action" variant="text" onClick={handleClose}>
        Cancel
      </mdui-button>
      <mdui-button slot="action" variant="tonal" onClick={handleCreate}>
        Create
      </mdui-button>
    </mdui-dialog>
  );
}
```

---

## Step 18 — `src/pages/Clipboards/DeleteDialog.tsx`

```tsx
import { useMduiDialog } from '../../hooks/useMdui';

interface DeleteDialogProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDialog({ open, name, onClose, onConfirm }: DeleteDialogProps) {
  const dialogRef = useMduiDialog(open, onClose);

  return (
    <mdui-dialog
      ref={dialogRef}
      headline={`Delete "${name}"?`}
      icon="delete_forever"
      close-on-overlay-click
      close-on-esc
    >
      <p
        className="mdui-typescale-body-medium"
        style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
      >
        This will permanently remove the clipboard and its raw endpoint. This cannot be undone.
      </p>

      <mdui-button slot="action" variant="text" onClick={onClose}>
        Cancel
      </mdui-button>
      <mdui-button
        slot="action"
        variant="tonal"
        onClick={onConfirm}
        style={{ color: 'var(--mdui-color-error)' }}
      >
        Delete
      </mdui-button>
    </mdui-dialog>
  );
}
```

---

## Step 19 — `src/pages/Clipboards/index.tsx`

Fixes the breakpoint mismatch by importing `useIsMobile` (single source of truth, 599 px)
instead of the old inline `useMediaQuery('(max-width: 899px)')`.

```tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { snackbar } from 'mdui';
import { useIsMobile } from '../../hooks/useBreakpoint';
import ClipboardList from './ClipboardList';
import ClipboardEditor from './ClipboardEditor';
import CreateDialog from './CreateDialog';
import DeleteDialog from './DeleteDialog';
import useClipboards from '../../hooks/useClipboards';

interface ClipboardsPageProps {
  token: string | null;
}

function clipboardUrl(id: string, slug?: string): string {
  return `${window.location.origin}${slug ? `/clips/${slug}` : `/clips/${id}`}`;
}

export default function ClipboardsPage({ token }: ClipboardsPageProps) {
  const isMobile = useIsMobile();
  const {
    clipboards, selected, isLoading,
    fetchAll, select, create, update, remove, fetchRawContent,
  } = useClipboards();

  const [createOpen,        setCreateOpen]        = useState(false);
  const [deleteTarget,      setDeleteTarget]       = useState<{ id: string; name: string } | null>(null);
  const [mobileEditorOpen,  setMobileEditorOpen]   = useState(false);
  const [contentCache,      setContentCache]       = useState<Record<string, string>>({});

  useEffect(() => { if (token) fetchAll(token); }, [token, fetchAll]);

  const handleSelect = useCallback(async (id: string) => {
    select(id);
    if (isMobile) setMobileEditorOpen(true);
    if (!contentCache[id]) {
      const c = await fetchRawContent(id);
      setContentCache(prev => ({ ...prev, [id]: c }));
    }
  }, [select, isMobile, contentCache, fetchRawContent]);

  const handleCreate = useCallback(async (name: string, slug?: string) => {
    if (!token) return;
    const id = await create(token, name, slug);
    if (id) {
      snackbar({ message: 'Clipboard created', placement: 'bottom', autoCloseDelay: 2500 });
      select(id);
      if (isMobile) setMobileEditorOpen(true);
    } else {
      snackbar({ message: 'Failed to create clipboard', placement: 'bottom', autoCloseDelay: 3000 });
    }
  }, [token, create, select, isMobile]);

  const handleUpdate = useCallback(
    async (tok: string, id: string, data: { name?: string; content?: string; slug?: string; useBase64?: boolean }) =>
      update(tok, id, data),
    [update],
  );

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return;
    const ok = await remove(token, id);
    if (ok) {
      snackbar({ message: 'Clipboard deleted', placement: 'bottom', autoCloseDelay: 2500 });
      setMobileEditorOpen(false);
    } else {
      snackbar({ message: 'Failed to delete', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setDeleteTarget(null);
  }, [token, remove]);

  const handleCopyUrl = useCallback(async (id: string) => {
    const cb = clipboards.find(c => c.id === id);
    const url = clipboardUrl(id, cb?.slug);
    try {
      await navigator.clipboard.writeText(url);
      snackbar({ message: 'Raw URL copied', placement: 'bottom', autoCloseDelay: 2000 });
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, [clipboards]);

  const selectedWithContent = useMemo(() => {
    if (!selected) return null;
    return { ...selected, content: contentCache[selected.id] ?? selected.content ?? '' };
  }, [selected, contentCache]);

  // Mobile editor view
  if (isMobile && mobileEditorOpen && selectedWithContent) {
    return (
      <div className="mobile-pb" style={{ height: '100%', overflow: 'auto' }}>
        <mdui-button
          variant="text"
          icon="arrow_back"
          style={{ margin: 8 }}
          onClick={() => setMobileEditorOpen(false)}
        >
          Back
        </mdui-button>
        <ClipboardEditor
          clipboard={selectedWithContent}
          token={token}
          onUpdate={handleUpdate}
        />
      </div>
    );
  }

  const isEmpty = !isLoading && clipboards.length === 0;

  return (
    <div className={`page-fill${isMobile ? ' mobile-pb' : ''}`}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 24px 16px',
        }}
      >
        <div>
          <p className="mdui-typescale-headline-medium" style={{ margin: '0 0 2px' }}>
            Clipboards
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            Freeform text storage with raw endpoints.
          </p>
        </div>
        <mdui-button variant="tonal" icon="add" onClick={() => setCreateOpen(true)}>
          New Clipboard
        </mdui-button>
      </div>

      {isEmpty ? (
        <div className="empty-state">
          <mdui-icon
            name="content_paste"
            style={{ fontSize: 64, color: 'var(--mdui-color-outline)' }}
          />
          <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>
            No clipboards yet
          </p>
          <p
            className="mdui-typescale-body-medium"
            style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}
          >
            Create one to start storing text with its own raw URL endpoint.
          </p>
          <mdui-button variant="tonal" icon="add" onClick={() => setCreateOpen(true)}>
            Create your first clipboard
          </mdui-button>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ClipboardList
            clipboards={clipboards}
            selectedId={selected?.id ?? null}
            isLoading={isLoading}
            onSelect={handleSelect}
            onRename={(id) => { select(id); if (isMobile) setMobileEditorOpen(true); }}
            onCopyUrl={handleCopyUrl}
            onDelete={(id) => {
              const cb = clipboards.find(c => c.id === id);
              if (cb) setDeleteTarget({ id, name: cb.name });
            }}
          />
          {selectedWithContent && !isMobile && (
            <ClipboardEditor
              clipboard={selectedWithContent}
              token={token}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <DeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </div>
  );
}
```

---

## Step 20 — `src/pages/Files/index.tsx`

Fixes:
- **`enterFolder` bug** — folder names were stored as `""`, making breadcrumbs blank.
  Replaced with explicit `currentFolderName` state so breadcrumb trails are always correct.
- **`navigateBreadcrumb` was off-by-one** — breadcrumbs array included root at index 0 but
  the function read `folderStack[index]` which skipped root. Rewritten cleanly.
- **Main-thread base64** — replaced synchronous `for` loop with `fileToBase64` from utils.
- **Hardcoded `rgba(17,19,24,0.85)`** — replaced with `color-mix` via `.drop-overlay` CSS
  class using `var(--mdui-color-surface)`.
- **`relativeTime` and `formatSize`** — imported from shared util, not redefined locally.

```tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { snackbar } from 'mdui';
import { useMduiDialog, useMduiInput } from '../../hooks/useMdui';
import { relativeTime, formatSize } from '../../utils/time';
import { fileToBase64 } from '../../utils/upload';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  isFolder?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

function fileIconName(mimeType: string, isFolder?: boolean): string {
  if (isFolder) return 'folder';
  if (mimeType.startsWith('image/')) return 'image';
  if (/zip|tar|rar|7z/.test(mimeType)) return 'archive';
  if (/json|xml|yaml/.test(mimeType)) return 'data_object';
  return 'description';
}

function fileUrl(id: string): string {
  return `${window.location.origin}/file/${id}`;
}

interface FilesPageProps {
  token: string | null;
}

export default function FilesPage({ token }: FilesPageProps) {
  const [allItems,           setAllItems]           = useState<FileItem[]>([]);
  const [isLoading,          setIsLoading]          = useState(true);
  const [currentFolderId,    setCurrentFolderId]    = useState('');
  const [currentFolderName,  setCurrentFolderName]  = useState('');  // FIX: track name
  const [folderStack,        setFolderStack]        = useState<Breadcrumb[]>([]);
  const [uploadOpen,         setUploadOpen]         = useState(false);
  const [folderOpen,         setFolderOpen]         = useState(false);
  const [deleteTarget,       setDeleteTarget]       = useState<FileItem | null>(null);
  const [copiedId,           setCopiedId]           = useState<string | null>(null);
  const [isDragging,         setIsDragging]         = useState(0);

  const deleteDialogRef = useMduiDialog(Boolean(deleteTarget), () => setDeleteTarget(null));

  const visibleItems = allItems.filter(f => f.parentId === currentFolderId);

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/.netlify/functions/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAllItems(await res.json() as FileItem[]);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // FIX: push current folder name into the stack before entering a child
  const enterFolder = useCallback((id: string, name: string) => {
    if (currentFolderId) {
      setFolderStack(prev => [...prev, { id: currentFolderId, name: currentFolderName }]);
    }
    setCurrentFolderId(id);
    setCurrentFolderName(name);
  }, [currentFolderId, currentFolderName]);

  const goBack = useCallback(() => {
    if (folderStack.length > 0) {
      const prev = folderStack[folderStack.length - 1]!;
      setFolderStack(s => s.slice(0, -1));
      setCurrentFolderId(prev.id);
      setCurrentFolderName(prev.name);
    } else {
      setCurrentFolderId('');
      setCurrentFolderName('');
    }
  }, [folderStack]);

  // FIX: rewritten — breadcrumbs = [root, ...stack, current]. index maps directly.
  const breadcrumbs: Breadcrumb[] = [
    { id: '', name: 'Files' },
    ...folderStack,
    ...(currentFolderId ? [{ id: currentFolderId, name: currentFolderName }] : []),
  ];

  const navigateBreadcrumb = useCallback((index: number) => {
    if (index >= breadcrumbs.length - 1) return; // already at this crumb
    if (index === 0) {
      setCurrentFolderId('');
      setCurrentFolderName('');
      setFolderStack([]);
    } else {
      const target = breadcrumbs[index]!;
      setCurrentFolderId(target.id);
      setCurrentFolderName(target.name);
      setFolderStack(breadcrumbs.slice(1, index)); // ancestors between root and target
    }
  // breadcrumbs is derived state — disabling exhaustive-deps is correct here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderStack, currentFolderId, currentFolderName]);

  const handleCopyUrl = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(fileUrl(id));
      setCopiedId(id);
      snackbar({ message: 'File URL copied', placement: 'bottom', autoCloseDelay: 2000 });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      snackbar({ message: 'Failed to copy', placement: 'bottom', autoCloseDelay: 2500 });
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!token || !deleteTarget) return;
    const res = await fetch('/.netlify/functions/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: deleteTarget.id }),
    });
    if (res.ok) {
      snackbar({ message: 'Deleted', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } else {
      snackbar({ message: 'Failed to delete', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setDeleteTarget(null);
  }, [token, deleteTarget, fetchFiles]);

  const handleCreateFolder = useCallback(async (name: string) => {
    if (!token) return;
    const res = await fetch('/.netlify/functions/files?folder=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      snackbar({ message: 'Folder created', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } else {
      snackbar({ message: (await res.text()) || 'Failed to create folder', placement: 'bottom', autoCloseDelay: 3000 });
    }
  }, [token, currentFolderId, fetchFiles]);

  // FIX: use FileReader instead of synchronous ArrayBuffer loop
  const uploadFile = useCallback(async (file: File) => {
    if (!token) return;
    const base64 = await fileToBase64(file);
    const res = await fetch('/.netlify/functions/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: file.name,
        content: base64,
        mimeType: file.type || 'application/octet-stream',
        parentId: currentFolderId,
      }),
    });
    if (!res.ok) throw new Error('Upload failed');
  }, [token, currentFolderId]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      await uploadFile(file);
      snackbar({ message: 'File uploaded', placement: 'bottom', autoCloseDelay: 2000 });
      fetchFiles();
    } catch {
      snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    e.target.value = '';
  }, [token, uploadFile, fetchFiles]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(0);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    let ok = 0; let fail = 0;
    for (const f of files) {
      try { await uploadFile(f); ok++; }
      catch { fail++; }
    }
    fetchFiles();
    snackbar({
      message: fail === 0
        ? `${ok} file${ok !== 1 ? 's' : ''} uploaded`
        : `${ok} uploaded, ${fail} failed`,
      placement: 'bottom',
      autoCloseDelay: 3000,
    });
  }, [uploadFile, fetchFiles]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize   = visibleItems.reduce((acc, f) => acc + f.size, 0);
  const fileCount   = visibleItems.filter(f => !f.isFolder).length;
  const folderCount = visibleItems.filter(f =>  f.isFolder).length;
  const hasParent   = currentFolderId !== '';

  return (
    <div
      style={{ position: 'relative', minHeight: '100%' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragEnter={e => { e.preventDefault(); setIsDragging(n => n + 1); }}
      onDragLeave={e => { e.preventDefault(); setIsDragging(n => n - 1); }}
      onDrop={handleDrop}
    >
      {isDragging > 0 && (
        <div className="drop-overlay">
          <mdui-icon name="cloud_upload" style={{ fontSize: 64, color: 'var(--mdui-color-primary)' }} />
          <p className="mdui-typescale-headline-small" style={{ margin: 0, color: 'var(--mdui-color-primary)' }}>
            Drop files here
          </p>
        </div>
      )}

      <div className="page">
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <mdui-breadcrumb>
            {breadcrumbs.map((crumb, i) => (
              <mdui-breadcrumb-item
                key={crumb.id || 'root'}
                onClick={() => navigateBreadcrumb(i)}
                style={{
                  cursor: i < breadcrumbs.length - 1 ? 'pointer' : 'default',
                  color: i === breadcrumbs.length - 1
                    ? 'var(--mdui-color-on-surface)'
                    : 'var(--mdui-color-primary)',
                  fontSize: 22,
                }}
              >
                {crumb.name || 'Files'}
              </mdui-breadcrumb-item>
            ))}
          </mdui-breadcrumb>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <mdui-button
              variant="outlined"
              icon="create_new_folder"
              onClick={() => setFolderOpen(true)}
            >
              Folder
            </mdui-button>
            <mdui-button variant="tonal" icon="upload" onClick={() => setUploadOpen(true)}>
              Upload
            </mdui-button>
          </div>
        </div>

        {/* Stats row */}
        {visibleItems.length > 0 && (
          <div className="meta-row" style={{ marginBottom: 16 }}>
            {hasParent && (
              <mdui-button-icon icon="arrow_back" onClick={goBack} />
            )}
            <span
              className="mdui-typescale-body-small"
              style={{ color: 'var(--mdui-color-on-surface-variant)' }}
            >
              {[
                folderCount > 0 && `${folderCount} folder${folderCount > 1 ? 's' : ''}`,
                fileCount   > 0 && `${fileCount} file${fileCount > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
              {visibleItems.length > 0 && ` · ${formatSize(totalSize)} total`}
            </span>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <mdui-skeleton key={i} style={{ height: 52, borderRadius: 'var(--mdui-shape-corner-small)', display: 'block' }} />
            ))}
          </div>
        ) : visibleItems.length === 0 && !hasParent ? (
          <div className="empty-state">
            <mdui-icon name="cloud_upload" style={{ fontSize: 64, color: 'var(--mdui-color-outline)' }} />
            <p className="mdui-typescale-headline-small" style={{ margin: 0 }}>No files yet</p>
            <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
              Upload a file or drop files anywhere on this page.
            </p>
            <mdui-button variant="tonal" icon="upload" onClick={() => setUploadOpen(true)}>
              Upload your first file
            </mdui-button>
          </div>
        ) : visibleItems.length === 0 && hasParent ? (
          <p className="mdui-typescale-body-medium" style={{ color: 'var(--mdui-color-on-surface-variant)', textAlign: 'center', padding: '32px 0' }}>
            This folder is empty
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleItems.map(file => (
              <div
                key={file.id}
                className={`file-row${file.isFolder ? ' file-row--folder' : ''}`}
                onClick={() => file.isFolder && enterFolder(file.id, file.name)}
              >
                <mdui-icon
                  name={fileIconName(file.mimeType, file.isFolder)}
                  style={{
                    fontSize: 20,
                    color: file.isFolder ? 'var(--mdui-color-primary)' : 'var(--mdui-color-on-surface-variant)',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="mdui-typescale-body-medium" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  {!file.isFolder && (
                    <div className="file-meta">
                      <span className="mdui-typescale-body-small" style={{ color: 'var(--mdui-color-on-surface-variant)' }}>
                        {formatSize(file.size)}
                      </span>
                      <span style={{ color: 'var(--mdui-color-outline-variant)' }}>·</span>
                      <span className="mdui-typescale-body-small" style={{ color: 'var(--mdui-color-on-surface-variant)' }}>
                        {relativeTime(file.createdAt)}
                      </span>
                    </div>
                  )}
                </div>

                {!file.isFolder && (
                  <mdui-tooltip content="Copy raw URL">
                    <mdui-button-icon
                      icon={copiedId === file.id ? 'check' : 'content_copy'}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleCopyUrl(file.id); }}
                      style={copiedId === file.id ? { color: 'var(--mdui-color-primary)' } : undefined}
                    />
                  </mdui-tooltip>
                )}

                <mdui-tooltip content="Delete">
                  <mdui-button-icon
                    icon="delete_outline"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteTarget(file); }}
                    style={{ color: 'var(--mdui-color-on-surface-variant)' }}
                  />
                </mdui-tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        token={token}
        currentFolderId={currentFolderId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); fetchFiles(); }}
      />

      <CreateFolderDialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      {/* Delete confirmation */}
      <mdui-dialog
        ref={deleteDialogRef}
        headline={`Delete ${deleteTarget?.isFolder ? 'folder' : 'file'} "${deleteTarget?.name}"?`}
        icon="delete_forever"
        close-on-overlay-click
        close-on-esc
      >
        <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
          {deleteTarget?.isFolder
            ? 'This will permanently remove the folder and all its contents.'
            : 'This will permanently remove the file and its raw endpoint.'}
        </p>
        <mdui-button slot="action" variant="text" onClick={() => setDeleteTarget(null)}>
          Cancel
        </mdui-button>
        <mdui-button
          slot="action"
          variant="tonal"
          onClick={handleDelete}
          style={{ color: 'var(--mdui-color-error)' }}
        >
          Delete
        </mdui-button>
      </mdui-dialog>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </div>
  );
}

/* ─── Upload Dialog ──────────────────────────────────────────────────────── */

interface UploadDialogProps {
  open: boolean;
  token: string | null;
  currentFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadDialog({ open, token, currentFolderId, onClose, onUploaded }: UploadDialogProps) {
  const [mode,        setMode]        = useState<'file' | 'url'>('file');
  const [url,         setUrl]         = useState('');
  const [fileName,    setFileName]    = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const dialogRef  = useMduiDialog(open, onClose);
  const urlRef     = useMduiInput(url, setUrl);
  const nameRef    = useMduiInput(fileName, setFileName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async () => {
    if (!token) return;
    if (mode === 'file') { fileInputRef.current?.click(); return; }
    setIsUploading(true);
    const name = fileName.trim() || `from-url-${Date.now()}`;
    const params = new URLSearchParams({ name, url, parentId: currentFolderId });
    const res = await fetch(`/.netlify/functions/files?${params}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      snackbar({ message: 'File uploaded from URL', placement: 'bottom', autoCloseDelay: 2500 });
      onUploaded();
    } else {
      snackbar({ message: (await res.text()) || 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsUploading(false);
  }, [token, mode, url, fileName, currentFolderId, onUploaded]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setIsUploading(true);
    try {
      const base64 = await fileToBase64(file);  // FIX: non-blocking
      const res = await fetch('/.netlify/functions/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: file.name,
          content: base64,
          mimeType: file.type || 'application/octet-stream',
          parentId: currentFolderId,
        }),
      });
      if (res.ok) {
        snackbar({ message: 'File uploaded', placement: 'bottom', autoCloseDelay: 2000 });
        onUploaded();
      } else {
        snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
      }
    } catch {
      snackbar({ message: 'Upload failed', placement: 'bottom', autoCloseDelay: 3000 });
    }
    setIsUploading(false);
    e.target.value = '';
  }, [token, currentFolderId, onUploaded]);

  return (
    <mdui-dialog ref={dialogRef} headline="Upload File" close-on-overlay-click close-on-esc>
      <div className="field-group">
        <div className="mode-toggle">
          <mdui-button
            variant={mode === 'file' ? 'tonal' : 'outlined'}
            icon="upload_file"
            onClick={() => setMode('file')}
          >
            From disk
          </mdui-button>
          <mdui-button
            variant={mode === 'url' ? 'tonal' : 'outlined'}
            icon="insert_link"
            onClick={() => setMode('url')}
          >
            From URL
          </mdui-button>
        </div>

        {mode === 'url' ? (
          <>
            <mdui-text-field ref={urlRef} variant="outlined" label="File URL" placeholder="https://example.com/file.pdf" />
            <mdui-text-field ref={nameRef} variant="outlined" label="File name (optional)" placeholder="my-file.pdf" />
          </>
        ) : (
          <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
            <mdui-icon name="cloud_upload" style={{ fontSize: 40, color: 'var(--mdui-color-outline)' }} />
            <p className="mdui-typescale-body-medium" style={{ margin: 0, color: 'var(--mdui-color-on-surface-variant)' }}>
              Click to select a file
            </p>
          </div>
        )}
      </div>

      <mdui-button slot="action" variant="text" onClick={onClose}>Cancel</mdui-button>
      <mdui-button
        slot="action"
        variant="tonal"
        onClick={handleUpload}
        disabled={isUploading || (mode === 'url' && !url.trim())}
      >
        {isUploading ? 'Uploading…' : 'Upload'}
      </mdui-button>

      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
    </mdui-dialog>
  );
}

/* ─── Create Folder Dialog ───────────────────────────────────────────────── */

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

function CreateFolderDialog({ open, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const dialogRef = useMduiDialog(open, onClose);
  const nameRef   = useMduiInput(name, setName);

  const handle = useCallback(() => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  }, [name, onCreate, onClose]);

  return (
    <mdui-dialog ref={dialogRef} headline="New Folder" close-on-overlay-click close-on-esc>
      <div style={{ marginTop: 8 }}>
        <mdui-text-field
          ref={nameRef}
          variant="outlined"
          label="Folder name"
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handle(); }}
          style={{ width: '100%' }}
        />
      </div>
      <mdui-button slot="action" variant="text" onClick={onClose}>Cancel</mdui-button>
      <mdui-button slot="action" variant="tonal" onClick={handle}>Create</mdui-button>
    </mdui-dialog>
  );
}
```

---

## Files to Delete

```
src/theme/theme.ts
src/components/SnackbarProvider.tsx
src/components/BottomNav.tsx   ← absorbed into App.tsx
```

---

## Bug Fix Checklist

| Bug | Where | Fix |
|---|---|---|
| `#0842A0` hardcoded as on-primary (×5) | `NavRail`, `ClipboardList` | Replaced with `var(--mdui-color-on-primary-container)` and `var(--mdui-color-on-primary)` from the live theme |
| `textTransform: 'none'` on every Button | All pages | Removed — MDUI buttons don't uppercase by default |
| Two different mobile breakpoints (599 vs 899 px) causing hybrid layout | `App`, `Clipboards/index` | Single constant: `useIsMobile` hook at 599 px, CSS at 599 px |
| Inconsistent border radius (3 competing values) | `SaveButton`, `RawUrlRow`, `Paper` | MDUI shape tokens (`--mdui-shape-corner-*`) everywhere |
| `enterFolder` stored `name: ""` — blank breadcrumbs | `Files/index` | `currentFolderName` state tracks active folder name |
| `navigateBreadcrumb` off-by-one | `Files/index` | Rewritten: breadcrumbs array index maps directly to navigation target |
| Synchronous ArrayBuffer base64 blocks main thread | `Files/index`, `UploadDialog` | `fileToBase64()` uses `FileReader.readAsDataURL` (off main thread) |
| Hardcoded `rgba(17,19,24,0.85)` in drag overlay | `Files/index` | `.drop-overlay` CSS class uses `color-mix(in srgb, var(--mdui-color-surface) 85%, transparent)` |
| `relativeTime` + `formatSize` duplicated | `ClipboardList`, `Files/index` | Moved to `src/utils/time.ts` |
| `ListItemIcon` double-imported under two names | `ClipboardList` | Eliminated entirely — MDUI uses string icon names |
| `pb: 7` magic number for bottom nav height | `App`, `Clipboards` | CSS class `.mobile-pb` with `padding-bottom: 80px` |
| `useMediaQuery` with raw string, not theme breakpoints | All | `useIsMobile()` hook owns the single breakpoint value |
| `MuiTextField` theme override targets wrong element | `theme.ts` | Deleted — MDUI inherits font from `body` |
