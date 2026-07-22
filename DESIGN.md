# Design System: AniSync

**Product:** AniSync (`anisync.ru`)  
**Source of truth:** `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`  
**Note:** Stitch MCP недоступен в этой среде — система синтезирована по живому UI-коду приложения.

## 1. Visual Theme & Atmosphere

Dark-first personal media hub: dense enough for watchlists and cards, calm enough for long browsing sessions. The mood is **nocturnal indigo** — cool violet-blue neutrals, soft surfaces, and restrained glow rather than neon spectacle. Light mode exists as a secondary, airy counterpart of the same hue family.

Hierarchy is quiet: typography and spacing do the work; chrome stays thin. The product should feel like a private dashboard for anime and releases, not a marketing landing page.

## 2. Color Palette & Roles

Values are HSL tokens from the app; approximate hex included for prompting.

### Light mode

| Name | Token / Hex | Role |
|------|-------------|------|
| Misty Indigo Canvas | `--background` ≈ `#F6F5F9` | Page backdrop |
| Ink Violet | `--foreground` ≈ `#2E2D36` | Primary text |
| Pure Surface | `--card` ≈ `#FFFFFF` | Cards, elevated panels |
| Vivid Iris | `--primary` ≈ `#6E5CE6` | Primary actions, focus ring, brand emphasis |
| Soft Iris Wash | `--secondary` ≈ `#E8E6F0` | Secondary buttons, subtle fills |
| Whisper Mist | `--muted` ≈ `#F0EEF5` | Muted backgrounds, disabled zones |
| Slate Violet | `--muted-foreground` ≈ `#68667A` | Secondary / helper text |
| Electric Amethyst | `--accent` ≈ `#8B5CF6` | Accents, highlights |
| Coral Alarm | `--destructive` ≈ `#EF4444` | Destructive actions, errors |
| Lilac Hairline | `--border` / `--input` ≈ `#DDDBE6` | Borders, input strokes |

### Dark mode (default product feel)

| Name | Token / Hex | Role |
|------|-------------|------|
| Deep Ink Void | `--background` ≈ `#17161C` | Page backdrop |
| Near-White Iris | `--foreground` ≈ `#F6F5F9` | Primary text |
| Raised Obsidian | `--card` ≈ `#23222B` | Cards floating above void |
| Inverted Primary | `--primary` ≈ `#F6F5F9` | High-contrast CTAs on dark |
| Iris on Light | `--primary-foreground` ≈ `#6E5CE6` | Text/icon on light primary |
| Dim Violet Panel | `--secondary` / `--border` ≈ `#3A3845` | Secondary surfaces, borders |
| Fogged Lilac | `--muted-foreground` ≈ `#9B98B0` | Meta text, timestamps |
| Electric Amethyst | `--accent` ≈ `#8B5CF6` | Accent / ring in dark |

Charts use a warm–cool set (`--chart-1`…`5`) for analytics accents only — not for brand chrome.

## 3. Typography Rules

- **Family:** Sofia Sans (Google Fonts), weights 400 / 500 / 600 / 700. Fallback: system sans.
- **Roles:** `font-body` and `font-headline` share Sofia Sans — one family, hierarchy via weight and size, not a second display face.
- **Character:** Geometric, slightly condensed utilitarian sans; readable in dense lists (anime library, torrent candidates). Avoid decorative serifs.
- **Code / mono:** generic monospace for hashes, IDs, technical snippets only.

## 4. Component Stylings

* **Buttons:** Subtly rounded corners (`--radius` 0.5rem ≈ 8px). Primary fills with Vivid Iris (light) or Near-White Iris (dark). Outline variants use hairline Lilac borders. Prefer clear min touch height on mobile controls.
* **Cards / Containers:** Same subtle radius; white or Raised Obsidian fill; **flat to whisper-soft elevation** — prefer border + background shift over heavy drop shadows. Cards are for interactive clusters (watchlist item, preferences), not for decorative wrapping.
* **Inputs / Forms:** Hairline border matching `--input`; transparent or muted fill; focus ring in Iris / Amethyst. Combobox-style fields (quality/audio) keep the same stroke language.
* **Dialogs / Sheets:** Popover surfaces use card colors; overlay dims the void without theatrical blur stacks.
* **Badges / Status:** Compact, muted or accent fills; avoid pill overcrowding in the first viewport of a view.

## 5. Layout Principles

- **Container:** Centered, padded (`2rem`), max width around 1400px at `2xl`.
- **Whitespace:** Comfortable vertical rhythm between sections; lists (releases, torrents) stay denser than marketing pages.
- **Grid:** Prefer simple one- or two-column forms on settings; card grids for catalogs that collapse cleanly on mobile.
- **Density:** Watchlist and torrent candidate lists are information-first — line-clamp titles, meta in smaller muted text.
- **Motion:** Use existing `tailwindcss-animate` sparingly for enter/exit of dialogs and loaders — presence, not noise.
- **PWA / dark:** Default visual language is dark; light mode must remain token-consistent, not a separate brand.

## 6. Prompting Notes (Stitch / UI generation)

When generating new AniSync screens:

1. Lead with **dark indigo void** + **iris accent**, not generic purple-on-white marketing gradients.
2. Keep **Sofia Sans**, 8px-class corner softness, flat cards with hairline borders.
3. One job per section; no hero marketing chrome inside app screens.
4. Respect module boundaries: Anime library, Releases calendar/watchlist, Torrents monitoring — shared shell (nav, notifications, settings).
