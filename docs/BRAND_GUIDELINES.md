# MobiTrack Pro — Brand & Design System

Single source of truth for color, typography, spacing, and component usage.
Every page must conform to this. No page may introduce a new hue, a new H1 size,
a new spinner, or a new modal pattern — reuse the primitives below instead.

---

## 1. Brand color

**Primary — Indigo**
| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| `brand-50` | #EEF2FF | indigo-50 | subtle backgrounds, selected row tint |
| `brand-100`| #E0E7FF | indigo-100 | hover backgrounds on light surfaces |
| `brand-500`| #6366F1 | indigo-500 | secondary emphasis, links on dark bg |
| `brand-600`| #4F46E5 | indigo-600 | **default primary action (buttons, active nav, icon tiles)** |
| `brand-700`| #4338CA | indigo-700 | hover/active state of primary buttons |
| `brand-900`| #312E81 | indigo-900 | deep accents, pressed states |

**Accent — Electric Cyan** (used sparingly: focus rings, "live/new" highlights, secondary data-viz series, sparkle/emphasis moments — never as a second primary button color)
| Token | Hex | Tailwind |
|---|---|---|
| `accent-400`| #22D3EE | cyan-400 |
| `accent-500`| #06B6D4 | cyan-500 |

**Nav / Shell — Indigo-tinted navy** (replaces flat `#0F172A` slate)
| Token | Hex | Usage |
|---|---|---|
| `nav-bg` | #1A1B3D | Sidebar background |
| `nav-bg-elevated` | #22244F | Sidebar hover surfaces, tooltips |
| `nav-border` | rgba(255,255,255,.07) | unchanged hairlines |

**Neutrals** — unchanged, keep Tailwind `slate` scale for all body text, borders, and surfaces (slate-50 background, slate-100 borders, slate-500 secondary text, slate-900 primary text). Do not mix `gray` and `slate` — `slate` only, everywhere.

### Rule: one primary color, period
`bg-blue-600` (or pink/violet/indigo/sky variants improvised per page) is retired.
Every "primary CTA" (Add, Save, Create, primary header icon tile) uses `brand-600`
via the shared `Button` / `PageHeader` components. A page must never hardcode its
own accent hue. The *only* place hue varies by feature is optional icon-tile
tinting for wayfinding (§6), and even that pulls from a fixed 6-slot palette,
never an arbitrary color.

---

## 2. Semantic colors (strict 4-color system)

These four meanings, and only these four, exist in the app. Nothing else may
claim a "meaning" color (teal for "payment", purple for "price change", etc.
are retired — use the neutral/tag treatment in §6 instead).

| Meaning | Color | Tailwind classes (badge) | Used for |
|---|---|---|---|
| **Success / positive** | Emerald | `bg-emerald-50 text-emerald-700 border-emerald-200` | Paid, Completed, In Stock, Active, Received, credit-to-us in ledgers |
| **Warning / attention** | Amber | `bg-amber-50 text-amber-700 border-amber-200` | Pending, Partial, Low Stock |
| **Danger / negative** | Rose | `bg-rose-50 text-rose-700 border-rose-200` | Unpaid, Refunded, Out of Stock, destructive actions, debit-from-us in ledgers |
| **Info / neutral highlight** | Brand indigo | `bg-indigo-50 text-indigo-700 border-indigo-200` | New, informational tags, "you are here" highlights |

Everything that isn't one of these four states (loyalty tiers, audit action
types, condition tags like Refurbished/Used) uses **neutral slate + an icon**,
never a new hue. See §6.

**Note on `red` vs `rose`:** the codebase currently mixes `red-*` and `rose-*`
for the same danger meaning. Standardize on **rose** (warmer, more premium,
pairs better with indigo than pure red does) for all danger/destructive
semantics. `destructive` button variant, delete-confirm dialogs, and negative
ledger amounts all use rose-600/rose-50.

### Ledger debit/credit — the one fixed rule
Across **every** ledger (Customer, Supplier, Person), the polarity color is
fixed relative to "money owed to the business", not relative to which party
performed the action:
- **Money owed TO the business** (customer owes us, we owe supplier a return, person owes us) → **rose** (a receivable/liability sitting open — needs attention)
- **Money settled / received / paid down** → **emerald** (positive/closed)

This replaces the current inverted convention (blue=debit on Customer Ledger,
emerald=debit on Supplier Ledger, third label scheme on Person Ledger). Labels
stay domain-appropriate ("Debit/Credit", "Gave/Took") but the **color** is
governed only by polarity, so a user who learns "rose = still owed" once,
understands it everywhere.

---

## 3. Typography

One H1 spec. No exceptions, no "text-base for less important pages."

| Level | Classes | Usage |
|---|---|---|
| Page title (H1) | `text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight` | Always via `<PageHeader>`. Every page. |
| Page description | `text-sm text-slate-500 mt-0.5 leading-snug` | Always via `<PageHeader>`. |
| Section heading | `text-sm font-semibold text-slate-900` | Card/section headers within a page |
| Stat card label | `text-[11px] font-semibold uppercase tracking-wide text-slate-500` | Standardized — adds uppercase/tracking to the existing shared `StatCard` spec so hand-rolled catalog tiles converge on it, instead of the reverse |
| Stat card value | `text-xl font-bold text-slate-900` | |
| Body | `text-sm text-slate-700` | |
| Caption/meta | `text-xs text-slate-400` | timestamps, helper text |

Required-field asterisk: always `text-rose-500` (not `red-400`/`red-500` mixed).

---

## 4. Spacing

- Page content container: no page wraps itself in extra `p-4`. The shell
  (`app-shell.tsx`) already applies `p-3 sm:p-4 md:p-6`. Pages start directly
  with their content / `<PageHeader>` at `space-y-4` (removes the
  double-padding drift and the one `max-w-[1400px]` outlier on Audit Log —
  all pages stretch full width consistently).
- Stat card grid gap: standardize on `gap-3 sm:gap-4` everywhere (was 2.5/3/2/4 mixed).
- Section vertical rhythm: `space-y-4` between major page sections.

---

## 5. Component rules (fixes duplication from the audit)

- **`PageHeader`** — every page uses it for title/description/icon/actions. No hand-rolled headers.
- **`StatCard`** — every stat tile uses it. Its `iconBg` pulls from the fixed
  wayfinding palette (§6), not arbitrary colors.
- **`StatusBadge`** — every status pill uses it, extended with any missing
  states rather than re-implemented locally (Used Phones' local StatusBadge/
  GradeBadge/PtaBadge get merged in here).
- **`DataTable`** — every tabular list uses it (search, sort, pagination,
  column visibility for free). Hand-rolled `<table>` markup is retired.
- **`PageLoader`** *(new shared component)* — one spinner spec
  (`h-8 w-8 border-4 border-slate-200 border-t-indigo-600`) replacing the 4
  different spinner sizes/weights currently copy-pasted ~15 times.
- **`DetailDrawer`** *(new shared component, built on existing `Sheet`
  primitive)* — one slide-in-from-right detail panel, replacing the 4
  independently hand-rolled drawers (Supplier Ledger, Person Ledger modal,
  Rebate, etc.).
- **`ConfirmDialog`** — the only sanctioned delete-confirmation pattern. Every
  delete action across the app goes through it (Persons and Person Ledger
  currently delete with no confirmation step — this is also a functional
  safety gap, not just a style one, and gets fixed as part of consistency work
  since it doesn't change what delete *does*, only that it now confirms first).
- **Single permission gate** — `PermissionGate` (per-page) is kept as the one
  mechanism since it also renders an in-page "Access Denied" state; the
  redundant route-level check in `AuthGuard`'s `ROUTE_PERMISSIONS` map is
  removed so permission strings are declared in exactly one place.

---

## 6. Wayfinding palette (fixed 6-slot, replaces arbitrary per-page hues)

For places where a feature benefits from a quick color cue (catalog
sub-sections, audit action-type tags, loyalty tiers) — pick from this fixed
list only, never invent a new hue:

| Slot | Color | Example use |
|---|---|---|
| 1 | Indigo (brand) | primary/default |
| 2 | Cyan (accent) | secondary wayfinding |
| 3 | Emerald | (reserved — semantic success, avoid reusing for wayfinding) |
| 4 | Amber | (reserved — semantic warning, avoid reusing for wayfinding) |
| 5 | Rose | (reserved — semantic danger, avoid reusing for wayfinding) |
| 6 | Slate + icon | neutral tag/category (default choice for non-status labels — audit action types, loyalty tiers, condition tags) |

In practice: catalog sub-pages (Brands/Colors/Models/RAM/Storage/Categories)
all use **indigo** (slot 1) as one consistent family accent — they are one
feature, not six. Loyalty tiers (Bronze/Silver/Gold/Platinum) and audit
action-types use neutral slate treatments with distinguishing icons rather
than a rainbow of one-off hues.

---

## 7. Breadcrumbs

`components/layout/breadcrumbs.tsx` gets a label for every route segment in
the app (rebate, ledger + children, finance, expenses, staff, audit-log,
inventory + children, returns, purchase-returns, persons, colors, models,
ram, storage) so no breadcrumb ever falls back to raw-cased segment text.

---

## 8. What does NOT change

This is a presentation-layer pass only. No API calls, data shapes, route
behavior, business logic, or permission *rules* (only the gating *mechanism*
dedup) change. Every fix is a class-name/markup/shared-component-adoption
change.
