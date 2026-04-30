# Keybox Service — UI/UX Specification

## Design Philosophy

This is a private, single-user admin tool. The design must be **utilitarian and fast** — zero friction between Yuri and saving his content. No decorative elements that don't earn their place. Every pixel is either functional or structural.

The aesthetic direction is: **refined dark utility** — the kind of internal tool that feels handcrafted and trustworthy, not like a SaaS product trying to impress. Think terminal meets Material Design 3.

---

## Design System

### Theme

**Mode:** Dark only. No light mode toggle. This is a developer tool used at any hour.

**Material Design version:** Material Design 3 (MD3) — use MUI v6 with the `experimental_extendTheme` or `createTheme` with MD3 tokens.

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `primary` | `#A8C7FA` | MD3 Primary — buttons, active states, links |
| `primary container` | `#0842A0` | Filled button backgrounds |
| `on primary container` | `#D6E3FF` | Text on filled buttons |
| `surface` | `#111318` | Page background |
| `surface container` | `#1E2128` | Card backgrounds, sidebar |
| `surface container high` | `#282C34` | Elevated cards, hover states |
| `outline` | `#8E9099` | Borders, dividers |
| `outline variant` | `#44474F` | Subtle borders |
| `on surface` | `#E2E2E9` | Primary text |
| `on surface variant` | `#C5C6D0` | Secondary text, labels |
| `error` | `#FFB4AB` | Error states |
| `success` (custom) | `#6DD58C` | Save confirmation, success snackbar |
| `scrim` | `#000000` at 32% | Modal overlays |

### Typography — Material Design 3 Type Scale

Font family: **`Geist Mono`** for all text. Load from Google Fonts or Fontsource. A monospace font throughout is intentional — the entire tool deals with raw text and keys. It reinforces the utility aesthetic and makes copy-pasting raw URLs feel native.

| Role | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display Small | 36px | 400 | 44px | Not used |
| Headline Large | 32px | 400 | 40px | Not used |
| Headline Medium | 28px | 400 | 36px | Page titles |
| Headline Small | 24px | 400 | 32px | Section headers |
| Title Large | 22px | 400 | 28px | Card titles |
| Title Medium | 16px | 500 | 24px | Nav labels, dialog titles |
| Title Small | 14px | 500 | 20px | Chip labels, table headers |
| Body Large | 16px | 400 | 24px | Editor content |
| Body Medium | 14px | 400 | 20px | Descriptions, metadata |
| Body Small | 12px | 400 | 16px | Timestamps, footnotes |
| Label Large | 14px | 500 | 20px | Button labels |
| Label Medium | 12px | 500 | 16px | Snackbar text |
| Label Small | 11px | 500 | 16px | Badge text |

### Spacing

Use Material Design's 4px base unit strictly.

| Token | Value | Usage |
|---|---|---|
| `spacing(0.5)` | 4px | Micro gaps |
| `spacing(1)` | 8px | Icon padding, tight gaps |
| `spacing(2)` | 16px | Standard padding |
| `spacing(3)` | 24px | Card padding |
| `spacing(4)` | 32px | Section gaps |
| `spacing(6)` | 48px | Large section separation |

### Elevation (MD3 Tonal Elevation)

MD3 uses tonal surface overlays instead of drop shadows for dark themes.

| Level | Overlay opacity | Usage |
|---|---|---|
| 0 | 0% | Base surface (`#111318`) |
| 1 | 5% | Cards, sidebar (`#1E2128`) |
| 2 | 8% | Hover on cards (`#282C34`) |
| 3 | 11% | Navigation drawer |
| 4 | 12% | App bar when scrolled |
| 5 | 14% | Dialogs, menus |

### Shape (Border Radius)

| Token | Value | Usage |
|---|---|---|
| `shape.borderRadius` (XS) | 4px | Chips, small elements |
| `shape.borderRadius` (SM) | 8px | Input fields, buttons |
| `shape.borderRadius` (MD) | 12px | Cards |
| `shape.borderRadius` (LG) | 16px | Dialogs, drawers |
| `shape.borderRadius` (XL) | 28px | FAB |
| `shape.borderRadius` (full) | 50px | Circular buttons, avatars |

### Iconography

Use **`@mui/icons-material`** exclusively. Icon size: 24px default, 20px in dense contexts. Never use custom SVG icons.

---

## Layout & Navigation

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  Navigation Rail (left, 80px wide, always visible)  │
│  ┌──────┐  ┌───────────────────────────────────────┐│
│  │      │  │                                       ││
│  │ Rail │  │         Page Content Area             ││
│  │      │  │                                       ││
│  │      │  │                                       ││
│  └──────┘  └───────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Navigation Rail** — MD3 Navigation Rail component, permanently visible on desktop. No hamburger menu, no collapsing. The app has exactly two destinations — a full drawer would be overkill.

Rail width: **80px**  
Rail background: `surface container` (`#1E2128`)  
Rail has no top app bar above it.

### Navigation Rail Structure

```
┌─────────┐
│         │
│  [Logo] │   ← Simple key icon (Key from MUI icons), 28px, primary color
│         │
│─────────│
│         │
│ [🔑]   │   ← Keybox destination
│Keybox   │
│         │
│─────────│
│         │
│ [📋]   │   ← Clipboards destination
│Boards   │
│         │
│         │
│         │
│─────────│
│         │
│ [👤]   │   ← Avatar/logout at bottom
│         │
└─────────┘
```

**Rail items:**
- Icon: 24px, centered
- Label: Body Small (12px), centered below icon
- Active indicator: MD3 pill shape, `primary container` background, full width of rail minus 16px margins
- Active icon color: `on primary container`
- Active label color: `on surface`
- Inactive icon color: `on surface variant`
- Inactive label color: `on surface variant`

**User section (bottom of rail):**
- MUI `Avatar` component, size 36px, with Yuri's initials
- On click: small `Menu` pops with a single item: "Sign out" with `Logout` icon
- No tooltip needed — it's obvious

### Responsive Behavior

| Breakpoint | Navigation |
|---|---|
| `xs` / `sm` (< 600px) | Bottom Navigation Bar (MD3), same 2 destinations |
| `md`+ (≥ 600px) | Navigation Rail (left side) |

On mobile, the bottom bar replaces the rail entirely. Content area takes full width.

---

## Page 1 — Keybox

### Purpose

One job: paste or type the keybox as plain text, save it, and get the raw URL. Nothing else on this page.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Page Header                                        │
│  "Keybox"  [Headline Medium]                        │
│  "Your private keybox. Stored as base64."           │
│  [Body Medium, on surface variant]                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Raw URL Card                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ RAW URL  [Label Small, outline variant]        │ │
│  │ https://yoursite.netlify.app/.netlify/...      │ │
│  │ [Body Medium, on surface, truncated]  [Copy🗐] │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Editor Card                                        │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │  [Multiline TextField — grows with content]   │ │
│  │                                               │ │
│  │  Placeholder: "Paste your keybox here..."     │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Action Row                                         │
│  [Character count  Body Small]     [Save  Button→] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component Specs

#### Page Header
- `Headline Medium` for the title "Keybox"
- Subtitle in `Body Medium`, color `on surface variant`
- Top padding: `spacing(4)` — 32px
- Bottom padding: `spacing(3)` — 24px

#### Raw URL Card
- MUI `Paper` component, elevation level 1 (`surface container`)
- Border radius: 12px
- Padding: `spacing(2)` — 16px
- Layout: horizontal flex row, `align-items: center`
- Left: stacked label + URL text
  - Label: "RAW URL" in `Label Small`, color `outline` — functions as a field label
  - URL text: `Body Medium`, color `on surface`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, `max-width: calc(100% - 48px)`
- Right: MUI `IconButton` with `ContentCopy` icon, size small
  - On click: copies URL to clipboard, icon transitions to `Check` icon for 1500ms then back
  - `Tooltip` on hover: "Copy raw URL"

#### Editor Card
- MUI `Paper` component, elevation level 1
- Border radius: 12px
- Padding: `spacing(2)` — 16px
- Contains a single MUI `TextField`:
  - `variant="standard"` — no visible border box, the card is the container
  - `multiline`
  - `fullWidth`
  - `minRows={12}` — starts tall enough to feel like a proper editor
  - `maxRows` — uncapped, grows with content
  - Font: inherit Geist Mono, `Body Large` size
  - `placeholder="Paste your keybox here..."`
  - No label — the card's position and the placeholder are enough
  - Disables spell check: `inputProps={{ spellCheck: false }}`

#### Action Row
- Horizontal flex, `justify-content: space-between`, `align-items: center`
- Left: character count string: `"1,204 characters"` in `Body Small`, color `on surface variant`. Updates live as user types.
- Right: MUI `Button`
  - `variant="contained"` — filled, MD3 style
  - `startIcon={<Save />}`
  - Label: "Save"
  - `size="large"`
  - Loading state: replace with `CircularProgress` size 20px inside button while the POST is in flight. Use MUI `LoadingButton` from `@mui/lab`.
  - Disabled when: content hasn't changed since last save (track `savedContent` vs `currentContent` in state)

### States

#### Unsaved Changes Indicator
When `currentContent !== savedContent`, show a small `FiberManualRecord` icon (8px) in `primary` color to the left of the "Save" button. This is the only indicator that there are unsaved changes. No banner, no dialog.

#### Empty State
When the editor is empty and nothing has been saved yet, show the placeholder text inside the TextField. No additional empty state treatment — the placeholder is sufficient.

#### Save Success
MUI `Snackbar` anchored `bottom-center`:
- `Alert` severity `success`
- Icon: `CheckCircle`
- Message: "Keybox saved"
- `autoHideDuration={3000}`
- No action button

#### Save Error
MUI `Snackbar` anchored `bottom-center`:
- `Alert` severity `error`
- Icon: `ErrorOutline`
- Message: "Failed to save. Try again."
- `autoHideDuration={5000}`
- Action button: "Retry" — re-triggers the save function

#### Loading Initial Content
On page mount, the app fetches current saved content to populate the editor. During this fetch:
- Show a `Skeleton` component inside the editor card, `variant="rectangular"`, height matching `minRows` height
- The Save button is disabled during load

---

## Page 2 — Clipboards

### Purpose

A collection of named text clipboards. Each one has its own raw URL. Yuri can create, rename, edit, and delete them freely. No fixed schema — just a label and a body.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Page Header                                        │
│  "Clipboards"  [Headline Medium]                    │
│  "Freeform text storage with raw endpoints."        │
│  [Body Medium, on surface variant]                  │
│                              [+ New Clipboard  FAB] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Clipboard List  │  │   Editor Panel           │  │
│  │  (left column)   │  │   (right column)         │  │
│  │                  │  │                          │  │
│  │  [Clipboard A] ✓ │  │  [Selected clipboard     │  │
│  │  [Clipboard B]   │  │   editor opens here]     │  │
│  │  [Clipboard C]   │  │                          │  │
│  │                  │  │                          │  │
│  └─────────────────┘  └─────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Responsive Split

| Breakpoint | Layout |
|---|---|
| `xs`/`sm` (< 900px) | Single column: list view → tap item → full-screen editor (back button in top bar) |
| `md`+ (≥ 900px) | Two-column split: list left (320px fixed), editor right (fills remaining space) |

### Clipboard List (Left Column)

**Column width:** 320px, fixed, `surface container` background  
**Overflow:** `overflow-y: auto`, custom scrollbar styled to match theme  
**No top padding** — list starts immediately

Each clipboard is a MUI `ListItemButton`:

```
┌─────────────────────────────────┐
│ [📋] Clipboard Name             │
│      2 days ago · 340 chars     │
│                          [⋮]   │
└─────────────────────────────────┘
```

- **Icon:** `Description` MUI icon, 20px, color `on surface variant`
- **Primary text:** clipboard name, `Title Medium`, color `on surface`, single line with ellipsis overflow
- **Secondary text:** relative timestamp + character count, `Body Small`, color `on surface variant` (e.g. `"2 days ago · 340 chars"`)
- **Context menu button:** `IconButton` with `MoreVert` icon, 20px, appears on hover or on tap (mobile). Triggers a `Menu` with options:
  - "Rename" (`DriveFileRenameOutline` icon)
  - "Copy raw URL" (`Link` icon)
  - Divider
  - "Delete" (`DeleteOutline` icon, `error` color)
- **Active/selected state:** MD3 active indicator, `primary container` background on the list item, icon and primary text shift to `on primary container` color
- **Hover state:** `surface container high` background (`#282C34`)
- **Divider:** `MUI Divider` between items, `outline variant` color, 1px

**List header:** None. The page title is sufficient.

### Editor Panel (Right Column)

When a clipboard is selected, the right panel shows the full editor for that clipboard.

```
┌──────────────────────────────────────────────────┐
│  Panel Header                                    │
│  ┌──────────────────────────────────────────────┐│
│  │ [Editable name field]                         ││
│  │  "My Clipboard Name"  [Title Large]           ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  Raw URL Row                                     │
│  https://yoursite.netlify.app/.netlify/...  [🗐] │
│                                                  │
│  Editor                                          │
│  ┌──────────────────────────────────────────────┐│
│  │                                              ││
│  │  [Multiline TextField]                       ││
│  │                                              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  Action Row                                      │
│  [char count]                        [Save  →]  │
└──────────────────────────────────────────────────┘
```

#### Panel Header — Editable Name
- Rendered as a MUI `Typography` `Title Large` by default — looks like a title, not an input
- On click: transitions to a `TextField` `variant="standard"` in-place, `Title Large` font size, autofocused, full width
- On blur or Enter: saves the new name (triggers a PATCH request to update the clipboard name), reverts to `Typography` display
- On Escape: cancels edit, reverts to old name
- `Tooltip` on the typography: "Click to rename"
- A small `Edit` icon (16px, `on surface variant`) appears inline to the right of the name text on hover, to hint it's editable

#### Raw URL Row
- Same design as Keybox page Raw URL card but in a lighter, row-only treatment (no full card)
- Background: `surface container` pill/chip shape, `border-radius: 8px`, padding `spacing(1) spacing(2)`
- URL text truncated, copy icon on the right
- Each clipboard gets its own URL: `/.netlify/functions/clipboards/<clipboard-id>`

#### Editor TextField
- Same specs as Keybox editor: `variant="standard"`, `multiline`, `fullWidth`, `minRows={10}`, Geist Mono, no spell check
- Placeholder: `"Start typing..."`

#### Action Row
- Same as Keybox: character count left, `LoadingButton` right
- Same unsaved changes dot indicator

### Empty State (No Clipboards Yet)

When the user has no clipboards, the entire right panel and list area are replaced with a centered empty state:

```
         [ContentPaste icon, 64px, outline color]

              No clipboards yet

       Create one to start storing text
       with its own raw URL endpoint.

         [+ Create your first clipboard]
              [Contained Button]
```

- Icon: `ContentPasteOutline`, 64px, color `outline`
- Title: `Headline Small`, color `on surface`
- Subtitle: `Body Medium`, color `on surface variant`
- Button: MUI `Button`, `variant="contained"`, `startIcon={<Add />}`, triggers same action as FAB

### Empty State (Clipboard Selected, No Content)

When a clipboard exists but has no content yet, the editor is empty and the placeholder text is shown. No extra treatment.

### New Clipboard — FAB

- MUI `Fab` (Floating Action Button), `variant="extended"` (icon + text)
- Label: "New Clipboard"
- Icon: `Add`
- Position: top-right of the page header area (not fixed to viewport — sits in the document flow within the header row)
- On click: triggers the **Create Clipboard Dialog**

### Create Clipboard Dialog

MUI `Dialog`, centered, `maxWidth="xs"`, `fullWidth`

```
┌─────────────────────────────────┐
│  New Clipboard                  │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Name                     │   │
│  └─────────────────────────┘   │
│  [TextField, autofocused]       │
│                                 │
│  [Cancel]          [Create →]  │
└─────────────────────────────────┘
```

- Title: "New Clipboard" in `Title Large`
- Single `TextField`, label "Name", `variant="outlined"`, autofocused, `onKeyDown` — Enter submits
- Actions: "Cancel" (`text` Button) and "Create" (`contained` Button)
- "Create" disabled when name field is empty or only whitespace
- On submit: creates the clipboard, closes dialog, selects the new clipboard in the list, focuses the editor

### Delete Confirmation Dialog

MUI `Dialog`, centered, `maxWidth="xs"`, `fullWidth`

```
┌─────────────────────────────────┐
│  Delete "My Clipboard"?         │
│                                 │
│  This will permanently remove   │
│  the clipboard and its raw      │
│  endpoint. This cannot be       │
│  undone.                        │
│                                 │
│  [Cancel]          [Delete]    │
└─────────────────────────────────┘
```

- Title: `Title Large`
- Body: `Body Medium`, color `on surface variant`
- "Delete" button: `variant="contained"`, `color="error"` — red filled button, no icon
- On confirm: removes item from list, clears editor panel, shows success `Snackbar` "Clipboard deleted"

### Rename — Inline Only

Rename happens inline in the panel header (described above). No separate rename dialog. If on mobile (no panel visible), tapping "Rename" from the context menu opens a dialog identical in structure to the Create dialog but prefilled with the current name and titled "Rename".

---

## Shared UI Patterns

### Snackbars

All snackbars:
- Anchored: `bottom-center` on desktop, `bottom-center` on mobile
- `autoHideDuration`: 3000ms for success, 5000ms for error
- Use MUI `Alert` inside `Snackbar`
- Stack if multiple fire at once (use `notistack` library or MUI's `SnackbarProvider`)

| Trigger | Severity | Message |
|---|---|---|
| Save success | success | "Saved" |
| Save error | error | "Failed to save. Try again." |
| Copy URL | info | "Raw URL copied" |
| Clipboard created | success | "Clipboard created" |
| Clipboard deleted | success | "Clipboard deleted" |
| Rename success | success | "Renamed" |
| Auth error | error | "Session expired. Please sign in again." |

### Loading States

- **Page initial load:** `Skeleton` components in place of content. Never a full-page spinner.
- **Button loading:** `LoadingButton` from `@mui/lab`, replaces button content with `CircularProgress` size 20px
- **List item saving:** The item in the list gets a subtle `LinearProgress` bar at the bottom of the item while saving

### Auth Gate

The entire app is behind Netlify Identity. The login screen is not a custom page — use the default `netlify-identity-widget` modal. It appears automatically if no session exists. No custom login page needed.

The rail/bottom nav should not be visible until the user is authenticated.

### Transitions

- Page transition between Keybox and Clipboards: MUI `Fade` component, 200ms
- Dialog open/close: MUI `Dialog` default slide-up animation
- List item selection: background color transition, 150ms `ease`
- Icon button copy feedback (ContentCopy → Check): instant icon swap, no animation needed
- Snackbar entrance: default MUI slide animation

---

## Accessibility

- All interactive elements have `aria-label` where icon-only
- `TextField` components always have either `label` or `aria-label`
- Color is never the sole indicator of state — always paired with icon or text
- `Dialog` traps focus correctly (MUI default behavior)
- `Snackbar` alerts use `role="alert"` (MUI default behavior)
- Keyboard navigation: Tab through all interactive elements, Enter to activate buttons, Escape to close dialogs
- Minimum touch target size: 48x48px on mobile for all interactive elements

---

## File & Component Map (for coder reference)

```
src/
├── theme/
│   └── theme.ts                  # MUI createTheme with all tokens above
├── components/
│   ├── NavRail.tsx               # Navigation Rail (desktop)
│   ├── BottomNav.tsx             # Bottom Navigation (mobile)
│   ├── RawUrlRow.tsx             # Reusable raw URL display + copy button
│   ├── SaveButton.tsx            # LoadingButton wrapper with unsaved dot
│   └── SnackbarProvider.tsx      # Shared snackbar context
├── pages/
│   ├── Keybox.tsx                # Page 1
│   └── Clipboards/
│       ├── index.tsx             # Page 2 shell (split layout)
│       ├── ClipboardList.tsx     # Left column list
│       ├── ClipboardEditor.tsx   # Right column editor
│       ├── CreateDialog.tsx      # New clipboard dialog
│       └── DeleteDialog.tsx      # Delete confirmation dialog
├── hooks/
│   ├── useKeybox.ts              # Fetch/save keybox content
│   ├── useClipboards.ts          # CRUD for clipboards list
│   └── useAuth.ts                # Netlify Identity session
└── App.tsx                       # Router + auth gate + app shell
```

---

## What the Coder Must NOT Do

- Do not use a full `Drawer` component for navigation — use `NavigationRail` and `BottomNavigation`
- Do not add a `TopAppBar` on desktop — the rail replaces it entirely
- Do not use `variant="outlined"` for the editor `TextField` — the card is the visual container
- Do not add tooltips to obvious actions like "Save"
- Do not use light theme — dark only
- Do not add a "preview" of the base64 output — Yuri doesn't need to see it
- Do not add confirmation dialogs for saving — only for destructive actions (delete)
- Do not use custom colors outside the palette defined above
- Do not use any font other than Geist Mono
