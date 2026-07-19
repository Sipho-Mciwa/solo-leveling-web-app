# Solo Leveling UI Revamp — Design Spec & Implementation Prompt

Scope: visual/theming polish only (no structural/layout changes, no desktop-density work this pass). Icon system migration (emoji → Lucide) and login page inclusion are in scope.

---

## 1. Design tokens (`tailwind.config.ts`)

Extend the existing 7-token palette — don't replace it. Existing `bg`/`surface`/`border`/`accent`/`accent-light`/`muted`/`subtle` stay as-is.

**Add:**

| Token | Hex | Used for |
|---|---|---|
| `system` | `#38bdf8` | Secondary "HUD" accent — header chrome, system feed text, notification glow, quest-log inputs. This is the "arcane interface" color; keep `accent` (violet) reserved for rank/level/power moments so the two don't compete. |
| `system-light` | `#7dd3fc` | Lighter cyan — glows, hover states on system-colored elements |
| `danger` | `#f87171` | Formalizes existing red usage — penalties, boss, critical alerts |
| `danger-light` | `#fca5a5` | Danger glows/borders |
| `warning` | `#fbbf24` | Formalizes existing amber usage — urgency, time-pressure |
| `success` | `#34d399` | Formalizes existing emerald/green usage — completions |
| `info` | `#60a5fa` | Formalizes existing blue usage — neutral info, non-urgent tips |
| `rank-e` … `rank-s` | keep current per-rank colors, just move them from inline utility classes into named tokens (`rank-e`, `rank-d`, `rank-c`, `rank-b`, `rank-a`, `rank-s`) |

**Rule going forward:** no more ad hoc `red-400/10` etc. in components — always reference the named token. This is the tokenization the current-state doc flagged as missing.

---

## 2. Typography (`next/font`)

Add two font roles. Do not theme every line of text — over-theming reads as noisier, not more premium.

- **Display/numeric face** — for level numbers, XP counters, stat readouts, rank badges, countdown timers. Pick one: **Orbitron**, **Rajdhani**, or **Space Mono** (mono reads slightly more "terminal," Rajdhani/Orbitron read more "sci-fi HUD"). Load via `next/font/google`.
- **Body face** — keep system font stack, or swap to **Inter** if you want a small crispness upgrade. Used for everything else: labels, descriptions, nav, buttons.
- Bump the smallest text sizes: `text-[9px]`/`text-[10px]` → minimum `text-xs` (12px) except for true micro-labels (timestamps). Cramped tiny text undercuts the "HUD panel" feeling more than it saves space.

Apply the display face specifically to: `HunterCard` XP/level readout, `RankBadge`, `StatsRadarChart` CountUp numbers, `WeekendBossCard` countdown, `LevelUpModal` level number, `analytics/StatCards` figures.

---

## 3. Background texture (optional, cheap, high genre-signal)

Add a very low-opacity (3-5%) scanline or fine-grid CSS background texture to `bg` — applied at the `body` level or on major panel surfaces (`HunterCard`, `WeekendBossCard`). Pure CSS, no images:

```css
background-image:
  linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px);
background-size: 24px 24px;
```

Keep it subtle enough that it reads as "interface material," not decoration competing with content.

---

## 4. Icons — Lucide migration plan

Install `lucide-react`. Migrate in this order (lowest-risk, highest-visibility first):

1. **Header nav tabs** (Profile, Today, History, Analytics, Titles) — pair each with a Lucide icon (`User`, `CalendarCheck`, `History`, `BarChart3`, `Trophy`).
2. **Hand-written inline SVGs** (chevrons, checkmarks) → direct Lucide swap (`ChevronDown`, `Check`).
3. **RiskIndicators / streak** → `Flame` (on-fire), `AlertTriangle` (at-risk).
4. **Quest/stat emoji** → direct equivalents:
   - 💪 → `Dumbbell`
   - 🔥 → `Flame`
   - 🦵 → `Footprints` or `Activity`
   - 🏃 → `Footprints`
   - ⚡ → `Zap`
   - 🏆 → `Trophy`
   - 💀 → `Skull`
   - ⚠️ → `AlertTriangle`
5. **System feed glyphs** (◆⚠★☠✦⚡) → `Diamond`, `AlertTriangle`, `Star`, `Skull`, `Sparkles`, `Zap`.

**Keep as emoji/glyph (intentional exceptions):** `WeekendBossCard`'s breathing emoji, `LevelUpModal` celebration moment. These are flavor/personality beats, not functional UI — full icon replacement there would flatten the impact.

Standardize icon sizing: `16px` inline with text, `20px` for standalone buttons/nav, `24px`+ for hero/celebration moments. Add this as a documented convention since none currently exists.

---

## 5. Login page — bring into the system

Currently the only page with no `<Header />`, no card surface, no motion, no theming. Changes:

- Wrap the form in the same `rounded-3xl border bg-surface` treatment as `HunterCard`.
- Add the existing `app/template.tsx` page-transition fade (currently missing here).
- Reframe copy in "System" voice:
  - Sign-in heading → `"Authenticate to Access the System"`
  - Sign-up heading → `"New Hunter Registration"`
  - Submit button stays action-first per copy convention: `"Sign In"` / `"Register"` (avoid vague labels like "Submit")
- Use the new `system` (cyan) token for input focus states here — this page is the first thing a user sees, so it's a good place to introduce the secondary accent.
- Error text: keep it in the interface's voice, specific about what happened (e.g. `"Incorrect email or password"` not a generic "Something went wrong").

---

## 6. What's explicitly NOT in scope this pass

- No desktop-specific dense layout — single-breakpoint mobile-first stays as-is.
- No structural component changes beyond what's needed for the icon swap and login page.
- Confirm-before-delete on legacy components (`XPProgressBar`, `StatItem`, `RewardsPanel`, `XPToast`) — flagged for cleanup but not part of this visual pass unless they get touched incidentally.

---

## 7. Suggested implementation order

1. Tokens (`tailwind.config.ts`) — colors + font setup. Nothing else depends on anything until this lands.
2. Typography application to numeric/display elements.
3. Icon migration (Header first, then quest/stat components, then system feed).
4. Login page redesign.
5. Optional: background texture pass.
6. Self-review: screenshot key pages (`/`, `/dashboard`, `/login`, `LevelUpModal`, `WeekendBossCard`) against this spec before merging.
