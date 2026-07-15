# SeeSight — Frontend Design System

> **Source of truth:** [Figma — Seesight](https://www.figma.com/design/dNZeI8z2Q8Er1CgvjfFrgJ/Seesight)  
> **Prototype:** [Landing proto](https://www.figma.com/proto/dNZeI8z2Q8Er1CgvjfFrgJ/Seesight?node-id=49-1498&page-id=0%3A1&scaling=min-zoom&content-scaling=fixed)

This document is the frontend implementation guide extracted from the Figma file. When Figma and this document disagree after a design update, **Figma wins** — then update this file.

---

## Figma file map

| Page | Contents | Frontend impact |
|------|----------|-----------------|
| **Landing** | `Landing Default`, `Landing after fill` (desktop ~1440×2610) | Public marketing + trip search home |
| **Pitch Deck** | Brand slides, logo treatments, dark glow backgrounds | Brand tokens, logo usage, atmospheric backgrounds |

**Currently designed in Figma:** public Landing experience only.  
**Not yet in Figma:** auth screens, company dashboard, employee CRUD, trip detail, approvals, reports. Those screens must **extend this same visual language** until new frames are added — do not invent a second design system (no light admin theme unless Figma introduces one).

---

## Brand & visual direction

- **Mood:** Dark, modern travel — night sky / deep ocean, subtle world-map atmosphere, high-quality destination photography.
- **Not:** Light SaaS dashboard chrome, purple-on-white marketing templates, cream/serif newspaper layouts.
- **Logo:** `SEESIGHT` — uppercase, wide tracking, geometric sans-serif + circular globe/ring mark.
- **Voice in UI copy:** Prefer **lowercase** for headlines, labels, CTAs, FAQ (`travel smart.`, `search`, `not to miss trips...`). Logo stays uppercase.

---

## Layout

### Desktop (Landing)

- Artboard reference: **1440 × ~2610** (long scroll page).
- Structure (top → bottom):
  1. **Header** — logo left, profile avatar button right
  2. **Hero** — tagline + search widget
  3. **Featured** — `not to miss trips...` with region categories + trip cards
  4. **FAQ** — `frequently asked questions` two-column accordion
  5. **Footer** — black bar, logo, link columns, social icons

### Search widget (hero)

Horizontal cluster of **4 large rounded tiles** + primary CTA under the right side:

| Slot | Empty state (`Landing Default`) | Filled state (`Landing after fill`) |
|------|----------------------------------|-------------------------------------|
| 1 From | Solid color tile + `from?` | Photo card + bottom bar `from` / `City (IATA)` |
| 2 To | Solid color tile + `to?` | Photo card + bottom bar `to` / `City (IATA)` |
| 3 When | Solid color tile + `when?` | Split date stack: white **depart** + dark bordered **return** |
| 4 Details | Solid accent tile | Photo card + `2ppl / cheap / hostel inc.` |

CTA: pill button **`search`** under the rightmost tile.

Implement as **one component with two visual states** (empty vs filled), not two separate pages.

### Featured trips

- Heading: `not to miss trips...`
- Category tabs/columns: `europe`, `asia`, `ssn america` / `san america`, `other` (match Figma spelling on the frame you implement; keep consistent)
- Cards: destination image, price badge (e.g. `400 GEL`), date range, `see more`
- Optional playful categories from layers (e.g. `space`) — only ship if present in the final frame

### FAQ

- Two columns of accordion rows
- Dark rounded bars, thin light border, chevron right
- Sample questions from Figma (implement with CMS/static JSON, expandable answers)

### Footer

- Near-black background
- Logo + multi-column lowercase links (`help`, `privacy policy`, `log in`, `book trip`, …)
- Social icons (Instagram, Facebook, X/TikTok as in frame)

---

## Color tokens (implementation)

Exact hex may be refined when Dev Mode / exported tokens are available. Use these CSS variables as the starting system and adjust to match Figma eyedropper when implementing:

```css
:root {
  /* Atmosphere */
  --ss-bg-deep: #020814;
  --ss-bg-navy: #071428;
  --ss-bg-glow: #0a4a7a;
  --ss-bg-mid: #0e6e9c;
  --ss-map-line: rgba(255, 255, 255, 0.12);

  /* Text */
  --ss-text: #ffffff;
  --ss-text-muted: rgba(220, 235, 255, 0.72);
  --ss-text-on-light: #0a0a0a;

  /* Surfaces */
  --ss-surface: rgba(8, 24, 48, 0.72);
  --ss-surface-strong: #050d1a;
  --ss-border: rgba(255, 255, 255, 0.55);
  --ss-overlay: rgba(0, 0, 0, 0.55);

  /* CTA — vivid blue/violet pill from Figma */
  --ss-accent: #3b2cff;
  --ss-accent-hover: #5246ff;

  /* Empty search tiles (Landing Default) */
  --ss-tile-from: #2ec4c6;
  --ss-tile-to: #7ec8f0;
  --ss-tile-when: #a66b3d;
  --ss-tile-details: #b8e046;

  /* Footer */
  --ss-footer: #000000;
}
```

**Background recipe:** vertical / radial gradient — deep navy at top & bottom, brighter cyan-blue glow through mid sections; faint world-map + dotted route lines at low opacity (SVG or optimized asset). Do **not** ship a flat single-color page background.

---

## Typography

| Role | Treatment |
|------|-----------|
| Logo | Uppercase, bold, wide letter-spacing |
| Hero tagline | Lowercase, large sans, tight-ish leading, white |
| Section titles | Lowercase, large, light blue/white (`not to miss trips...`, FAQ) |
| UI labels / buttons | Lowercase (`search`, `depart`, `return`, FAQ items) |
| Body / links | Lowercase, smaller, muted white/blue |

**Font:** distinctive geometric sans (avoid Inter / Roboto / Arial as brand face). Candidates to evaluate against Figma: **Satoshi**, **General Sans**, **Clash Display** (logo/display), or the exact family embedded in the file. Load via `next/font` or self-hosted files once the font is confirmed from Figma.

---

## Shape & spacing

- **Cards / tiles:** large radius (~16–24px)
- **Primary CTA:** fully rounded pill
- **Date blocks:** stacked rounded rectangles; depart = light fill + dark text; return = dark fill + light border + light text
- **FAQ rows:** pill / rounded-rect bars
- **Gaps:** generous horizontal spacing between the 4 search tiles; page content centered with comfortable side margins on 1440 layouts
- **Image cards:** `object-fit: cover`; bottom caption bar with `--ss-overlay`

---

## Motion (intentional, minimal)

Ship at least:

1. Soft fade/rise on hero + search tiles on first paint
2. Hover lift or brightness on trip cards and search tiles
3. Accordion expand/collapse for FAQ

Avoid noisy particle systems or glow spam.

---

## Component inventory (Landing → code)

| Figma concept | Suggested React component |
|---------------|---------------------------|
| Header logo + profile | `SiteHeader` |
| Hero tagline | `HeroTagline` |
| 4-slot search (empty/filled) | `TripSearchWidget` |
| Photo destination tile | `SearchPhotoTile` |
| Depart/return stack | `DatePairField` |
| Search CTA | `Button` variant `pill` / `accent` |
| Featured section | `NotToMissTrips` + `TripTeaserCard` |
| FAQ | `FaqSection` + `FaqAccordionItem` |
| Footer | `SiteFooter` |
| Map atmosphere | `MapAtmosphereBackground` |

Build with **Next.js + TypeScript + Tailwind + shadcn/ui**, but **theme shadcn to these tokens** — do not keep default shadcn look.

---

## Frontend build rules (lead engineer)

1. Open Figma (Landing frames) before implementing any public UI screen.
2. Match layout hierarchy and empty/filled search states from `Landing Default` / `Landing after fill`.
3. Reuse tokens from this file (`globals.css` / Tailwind theme) — no one-off random hex in components.
4. Prefer real destination imagery over decorative gradients as the main visual idea on cards.
5. Keep marketing copy lowercase per Figma; product/admin data can use normal capitalization where readability requires it.
6. When implementing **undocumented** app screens (dashboard, auth, CRUD): reuse navy atmosphere, accent pill CTAs, rounded surfaces, and typography — then add Figma frames when design catches up.
7. Responsive: Figma is desktop-first; collapse search tiles to a vertical stack / 2×2 on tablet; single column on mobile; preserve atmosphere and CTA prominence.
8. After UI merges, update this doc if tokens or structure changed.

---

## Product alignment note

Thesis product (README) is **B2B travel management**. Current Figma Landing is a **trip discovery / search** public surface. Treat Landing as the branded entry + search UX; authenticated company workflows live behind profile/login and follow the same dark brand system until dedicated B2B frames exist.
