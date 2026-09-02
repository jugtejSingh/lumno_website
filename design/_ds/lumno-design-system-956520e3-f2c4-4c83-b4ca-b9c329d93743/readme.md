# Lumno Design System

Lumno is a practice-management admin backend for therapists — scheduling, client records, session notes, messaging, billing. The brand brief: **formal and sophisticated, but colorful and gen-z** — a balance of "class" and youth culture. Base palette is a warm beige with confident, saturated contrast colors; typography pairs a modern take on a Times-like serif with a clean grotesk for UI density.

**Sources**: none attached (no Figma file, codebase, or slide deck was provided for this project). Everything here — tokens, components, UI kit, copy — was originated from the one-paragraph brand brief above. If a codebase, Figma file, or brand deck exists, attach it and this system should be reconciled against it (component inventory, exact copy, real logo).

## Index
- `styles.css` — root stylesheet, imports everything below
- `tokens/` — colors, typography, spacing, radius, shadows, fonts, base resets
- `components/` — React primitives: `forms/`, `feedback/`, `navigation/`, `data-display/`
- `ui_kits/lumno-admin/` — the therapist admin backend: Dashboard, Schedule, Clients, Notes, Payments, Messages, Settings
- `ui_kits/lumno-marketing/` — public site: home (features), login, register, pricing ($1,000 Solo / $2,000 Practice per month)
- `guidelines/` — foundation specimen cards shown in the Design System tab
- `assets/` — icons (no client logo supplied — see Iconography)
- `templates/` — starter files consuming projects can copy
- `SKILL.md` — portable skill file for using this system in Claude Code

## Content fundamentals

**Voice**: warm but professional — a well-run front desk, not a wellness influencer. Second person ("you"), never baby-talk. Calm confidence over hype.

**Tone examples**:
- Empty state: *"No sessions today. Enjoy the quiet."*
- Save confirmation: *"Saved. Your client won't see this note."*
- Error: *"That didn't save — check your connection and try again."*
- Onboarding: *"Let's set up your first client. Takes about two minutes."*
- Button labels are verbs, lowercase-sentence-case, short: "Add client", "Send message", "Start session", not "SUBMIT" or "Add Client Now!"

**Casing**: sentence case everywhere (headings, buttons, nav labels) — no title case, no all-caps except tiny eyebrow labels/tags (which use letter-spacing, not shouting).

**Emoji**: not used in product chrome or system copy (a therapist's admin tool should read as calm and credible). A single emoji is permitted only in an illustrative chat-bubble mock (client-authored text), never in Lumno's own UI voice.

**Vibe**: think a well-designed diary crossed with a boutique hotel's booking system — soft materials, exact numbers, no wasted words. Colorful accents carry meaning (status, category) rather than decoration.

## Visual foundations

**Color**: a warm beige neutral ramp (`--beige-0`…`--beige-900`) is the field the product lives on — never stark white or pure black. Four accent families read as "gen-z color with formal restraint": **plum** (primary — links, primary buttons, focus), **coral** (energetic pop — alerts, highlights, a handful of tags), **sage** (calm/success — fits a therapy context), **citrus** (warning/highlight, used sparingly). Max two accents visible on a given screen at once; plum + one other. Backgrounds stay in the beige family; accents live in text, icons, tags, buttons — never large color fields.

**Type**: display serif (Instrument Serif, italic used often for warmth/emphasis) for page titles and big numbers; Archivo (grotesk) for everything functional — nav, tables, forms, buttons; Space Mono for IDs, timestamps, session codes. Headings are set fairly small and restrained for an admin tool (see `--text-h1`/`--text-h2`) — the serif shows up as flavor, not as giant marketing type.

**Spacing**: 4px base scale (`--space-1`=4 to `--space-12`=96). Admin density: 12–16px internal card padding, 24–32px between sections.

**Backgrounds**: flat beige fields, no photography, no gradients as backgrounds, no repeating patterns/textures. The one decorative liberty is an occasional soft "blob" radius (`--radius-blob`) on an illustrative accent shape or empty-state mark — used rarely, never on functional containers.

**Animation**: subtle and quick. Fades and gentle slide/scale-ins on `--duration-fast`/`--duration-base` with `--ease-out`; no bounce, no spring overshoot — bounce would undercut the "formal" half of the brief.

**Hover**: buttons/links darken one step (`--accent-primary` → `--accent-primary-hover`); ghost/tertiary surfaces gain a faint beige tint (`--beige-200`). No lightening-on-hover, no glow.

**Press**: darken one step further (`--accent-primary-press`) plus a 1px translateY — a tactile "press", not a scale/shrink.

**Borders**: 1px hairlines in `--border-subtle` (beige-300) on cards and inputs; `--border-strong` for focus/active outlines besides the focus ring itself.

**Shadows**: soft and warm-toned (shadows tinted toward beige/brown, not neutral gray) — `--shadow-xs/sm/md/lg`. Cards default to `--shadow-xs` at rest, `--shadow-sm` on hover for interactive cards. No inner glow / neumorphism.

**Radius**: 8–12px on controls and cards (`--radius-sm/md`), 18–28px on prominent surfaces like modals or hero cards, full pill (`--radius-pill`) on tags/badges/chip filters. No sharp 0px corners, no fully-rounded (blob) corners on functional containers.

**Layout rules**: persistent left sidebar nav in the admin kit; top bar holds search + account only. Content max-width is capped (not full-bleed) to keep tables/forms readable.

**Transparency & blur**: used only for overlay scrims behind modals/drawers (`oklch(20% 0.02 50 / 0.4)`) and a light `backdrop-filter: blur(8px)` on the top bar when content scrolls beneath it. Never used decoratively on cards.

**Imagery**: none supplied. Where a photo would go (e.g. client avatar), a placeholder is used — warm-toned, never black-and-white/desaturated, no heavy grain treatment specified since no source imagery exists.

**Cards**: `--surface-card` (near-white beige) fill, 1px `--border-subtle`, `--radius-md`, `--shadow-xs` at rest. No colored left-border accent strip (explicitly avoided as a cliché).

## Iconography

No icon set, icon font, or SVG sprite was supplied with the brand brief. **Substitution**: [Lucide](https://lucide.dev) icons via CDN (`unpkg.com/lucide@latest`) — a clean single-weight stroke set (1.75px stroke) that reads as neutral-modern without competing with the serif/grotesk pairing, and is easy to swap later for a bespoke set. Used at 18–20px in nav/buttons, 16px inline in tables. No emoji, no unicode glyphs-as-icons, no PNG icons. Flagging this substitution — if Lumno has (or wants) a bespoke icon set, provide it and this system should switch over.

## Intentional additions
No source defines a component inventory, so a standard admin-app set was authored from scratch, sized to what a therapist admin backend needs: Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Badge, Tag, Card, StatCard, Avatar, Tabs, Dialog, Toast, Tooltip, SidebarNavItem, TopBar.

## Fonts
Instrument Serif, Archivo, and Space Mono are loaded from Google Fonts CDN (`tokens/fonts.css`, `@import`) — no local binaries exist to copy in since this is a from-scratch brand with no supplied type. If Lumno licenses or prefers different faces, swap the `@import` and re-point `--font-display`/`--font-body`/`--font-mono` in `tokens/typography.css`.
