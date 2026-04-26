# Verdictu — Design System & Visual Identity

## Brand Summary

Verdictu is a legal AI platform with an editorial, newspaper-inspired visual identity. The design is high-contrast, typographically bold, and deliberately minimal in color — creating authority and trust through restraint rather than decoration.

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| Black | `#000000` | Borders, primary text, nav dividers, section outlines, footer bg |
| White | `#ffffff` | Page background, text on dark surfaces |
| Amber Accent | `#f8a100` / `var(--color-amber)` | Success Stories header bar, category badge fills |
| Forest Green | `#155240` / `var(--color-green)` | Our Mission section background |
| Electric Purple | `#850cff` / `var(--color-purple)` | Brand accent — TBD usage |
| Muted BG | `oklch(0.97 0 0)` ≈ `#f7f7f7` | Secondary surfaces, table category rows |
| Muted FG | `oklch(0.556 0 0)` ≈ `#6b6b6b` | Secondary text, captions |
| Indigo (active) | `indigo-50 / indigo-700` | DeepSearch toggle active state |
| Amber Warning | `amber-500` | Jurisdiction required warning state in chat input |
| Red | `oklch(0.58 0.22 27)` | Destructive / error states |

**Dark mode tokens** are defined but the public-facing marketing site operates in light mode.

---

## Typography

**Primary Typeface:** `General Sans` (self-hosted woff2)

| Weight | Class | File |
|---|---|---|
| 400 Regular | `font-regular` | `GeneralSans-Regular.woff2` |
| 500 Medium | `font-medium` | `GeneralSans-Medium.woff2` |
| 600 Semibold | `font-semibold` | `GeneralSans-Semibold.woff2` |

Fallback stack: `system-ui, sans-serif`

### Type Scale (custom utilities)

| Class | Size | Weight | Notes |
|---|---|---|---|
| `.text-subheading` | `clamp(2.25rem → 6.5rem)` | 600 | Uppercase, line-height: 1 — hero/section headers |
| `.text-subtitle` | `clamp(2.625rem → 5rem)` | 600 | Uppercase — footer CTA header |
| `.text-footer-title` | `clamp(2.625rem → 5rem)` | 600 | Uppercase, white |
| `.text-blog-subheading` | `clamp(3rem → 4.5rem)` | 600 | Article/blog headings |
| `.text-blog-quote` | `clamp(2rem → 3rem)` | 600 | Testimonial quotes, pricing amounts |
| `.text-blog-summary` | `1.375rem` | 500 | Article intro / summary text |
| `.heading3-title` | `2rem / 2.4rem` | 600 | Feature titles, outcome values, mission heading |
| `.podcast-title` | `clamp(1rem → 6.25rem)` | 600 | Uppercase — podcast hero |

**Label pattern** used throughout: `uppercase font-semibold tracking-widest text-sm`  
Used for plan names, section labels ("Our Mission", "Outcome"), counter indicators.

---

## Layout & Grid

- **Max container width:** `max-w-[95rem]` (1520px), centered with `mx-auto px-4`
- **Grid system:** Tailwind's grid, responsive columns:
  - Features: `grid-cols-1 md:grid-cols-3`
  - Our Mission: `grid-cols-1 md:grid-cols-2`
  - Success Stories: `grid-cols-1 md:grid-cols-[2fr_1fr]`
  - Pricing: `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`
  - Footer links: `grid-cols-1 2xl:grid-cols-2`
- **Section padding:** `p-8 md:p-12` on content blocks
- **Header:** `md:pt-8 pt-4` top, separated from content by `border-black border-t-0 border mt-4`

---

## Border & Shape Language

The design relies on **sharp black borders** as the primary structural element — no shadows on the main layout grid.

| Pattern | Usage |
|---|---|
| `border border-black` | Section containers, feature cards, pricing cards, carousel |
| `border-b border-black` | Row dividers, header separator, FAQ items |
| `border-r border-black` / `border-l` | Column dividers in multi-col sections |
| `rounded-full` | Category badges, prompt chips, progress indicator dots |
| `rounded-lg` | Chat input container, attachment items |
| `rounded-xl` | Products dropdown menu panel |
| Square (no radius) | Pricing CTA buttons, nav elements — sharp editorial feel |

Base radius variable: `--radius: 0.625rem` (used by shadcn components).

---

## Homepage Section Inventory

### 1. Header
- Logo: SVG (`/icons/verdictu-black.svg`) — left-aligned
- Desktop nav: links + Products hover dropdown + social icons + HR divider
- Mobile: hamburger (3 black rectangles) → Sheet slide-in from top
- Bottom border: full-width `border-black`

### 2. Hero
- **News Ticker:** Black bar, white text, `NEWS TICKER +++` label, infinite scroll animation (20s)
- **Marquee Prompts:** Single row of example prompt chips scrolling right (38s), pauses on hover. Chips: white bg, gray border, rounded-full, hover lifts `-translate-y-0.5` with indigo tint
- **AI Chat Input:** Central interaction element (see below)

### 3. Features Grid
- 3-column grid (`md:grid-cols-3`)
- Each card: `border border-black p-4 md:p-12`
- Feature image with `hover:scale-105 transition`
- `.heading3-title` title, date + duration metadata
- No card shadow — border defines the card

### 4. Success Stories Carousel
- Full-width bordered container
- **Header bar:** `bg-[#f8a100]` amber, counter `01 / 04`, prev/next square buttons (`w-10 h-10 border border-black`)
- **Quote panel:** `text-blog-quote` blockquote + amber `rounded-full` category badge
- **Person panel:** name (semibold), role, outcome value in `.heading3-title`
- **Progress bars:** thin `h-1.5` white bars at bottom, active bar animates black fill over 6s
- Slide fade-in animation: `opacity 0→1 + translateY 6px→0` over 0.35s

### 5. Our Mission
- 2-column: left = founder photo (full bleed `object-cover`), right = text panel
- Text panel bg: `bg-[#155240]` (forest green), `text-white`
- Label: `uppercase font-semibold tracking-widest text-sm`
- Border divider between columns: `border-r border-black` (md+)
- Founder signature at bottom: semibold name + role, separated by `border-t border-white`

### 6. Pricing Grid
- 4-column (`xl:grid-cols-4`), contained in single `border border-black`
- Columns separated by `border-r border-black`
- **Highlighted plan (Pro):** `bg-black text-white` with `border-white/20` dividers
- Plan label: `uppercase font-semibold tracking-widest text-sm`
- Price: `.text-blog-quote` (large, semibold)
- Badge ("Most popular"): `px-3 py-1 rounded-full border text-xs uppercase tracking-widest`
- Feature list: em-dash `—` bullets
- CTA button: full-width, square, `border-black hover:bg-black hover:text-white`; inverted on highlighted

### 7. Pricing Comparison Table
- Full-width, `border-collapse border border-black`
- Header row: `uppercase tracking-widest text-sm`, Pro column: `bg-black text-white`
- Category rows: muted bg, small uppercase label
- Boolean cells: checkmark SVG or `—` dash
- Responsive horizontal scroll wrapper

### 8. Pricing FAQ
- `.text-subheading` section header
- Items: `border-b border-black`, expand/collapse with `ChevronDown` rotate animation
- Answer text: `text-muted-foreground leading-relaxed`

### 9. Footer
- `bg-black overflow-hidden`
- Top: scrolling news ticker (white text on black)
- Logo: white SVG wordmark (inline path)
- 3-column link nav: white text, `space-y-3`
- Bottom row: copyright text + social icon links (Instagram, X, YouTube, LinkedIn)
- Bottom padding: `lg:pt-[6rem] lg:pb-[4.0625rem]`

---

## AI Chat Input

The central product interaction widget on the hero.

**Container:** `bg-secondary border border-border rounded-lg p-4`  
**Textarea:** transparent bg, `min-h-20`, `text-[15px]`, Sparkles icon prefix

**Toolbar controls (left):**
- Attach button (Paperclip icon, `border-border rounded-md`)
- DeepSearch toggle — off: muted; on: `bg-indigo-50 border-indigo-200 text-indigo-700`
- Jurisdiction selector — unset: amber warning border; set: normal border

**Toolbar controls (right):**
- General mode button (Scale icon)
- Ghost Mode toggle
- Storage pill (Cloud / Local) — active segment: `bg-foreground text-card`
- Citations toggle — custom toggle switch: `bg-foreground` when on
- Send button: `bg-foreground p-2 rounded-md text-card` (ArrowUp icon)

---

## Motion & Animation

| Animation | Trigger | Duration | Details |
|---|---|---|---|
| News ticker scroll | continuous | 20s linear infinite | `translateX(0 → -50%)` |
| Marquee prompts | continuous | 38s linear infinite | Pauses on hover (`animation-play-state: paused`) |
| Carousel slide fade | slide change | 0.35s ease | `opacity 0→1 + translateY 6→0` |
| Carousel progress bar | per slide | 6000ms linear | `width 0%→100%` |
| Feature image hover | hover | default transition | `scale(1.05)` |
| Products dropdown | group hover | 150ms | `opacity 0→1`, pointer-events toggle |
| FAQ chevron | click | 200ms | `rotate-180` |
| Prompt chip hover | hover | default | `-translate-y-0.5 + shadow-md` |

---

## Icon System

- **Lucide React** — used throughout UI (ChevronDown, Scale, Globe, Paperclip, Search, etc.)
- **Custom SVGs** in `/public/icons/`:
  - `verdictu-black.svg` — logo
  - `ri_instagram-line.svg`, `x-black.svg`, `ri_youtube-fill.svg`, `linkedin-black.svg` — socials
  - `ri_arrow-right-line.svg` — carousel prev/next

---

## Design Principles

1. **Editorial authority** — black borders, uppercase labels, and newspaper-grid layouts signal credibility
2. **Color restraint** — near-monochromatic with two accent colors (amber `#f8a100`, forest green `#155240`) used sparingly for emphasis
3. **Typography as structure** — clamp-based fluid type does the visual hierarchy work; no decorative dividers needed
4. **Hover as the only decoration** — interactions revealed on hover (scale, bg invert, shadow) rather than persistent visual noise
5. **Sharp over soft** — square CTA buttons and hard borders dominate; rounded shapes only for small tags/chips/badges
