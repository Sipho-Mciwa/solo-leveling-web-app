# Solo Leveling UI Restructure — Implementation Prompt

Scope: information architecture only — moving/splitting existing components into a new page structure. No new visual design in this pass (pairs with `solo-leveling-ui-revamp-spec.md` for the theming work).

**Frame of reference:** the System interrupts with what's urgent right now (quest windows, warnings); the Status window is checked separately for detail. The new Dashboard is the interrupt layer. Profile is the Status window.

---

## 1. New route structure

| Route | Before | After |
|---|---|---|
| `/` | Profile (identity landing) | **Dashboard** (new) — alerts + daily board + status strip |
| `/dashboard` | "Today" action board | merges into `/` — this route can redirect to `/` or be removed |
| `/profile` | did not exist as separate route | **Profile** (new) — everything currently on `/` minus the status-strip subset that moves to Dashboard |
| `/history` | unchanged | unchanged |
| `/analytics` | unchanged | unchanged |
| `/titles` | unchanged | unchanged |
| `/login` | unchanged | unchanged |

**Redirect**: add a redirect from the old `/dashboard` (if bookmarked/linked anywhere) to `/`.

---

## 2. New Dashboard (`/`) — composition, top to bottom

1. **Alert layer** — rendered first, before anything else, no conditional lazy-load delay:
   - `PenaltyAlert` (if active)
   - `WeekendBossCard` (if live/urgent)
   - `UrgencyBanner` (if applicable)
   - These already exist and work as-is — this is a *reposition*, not a rebuild. Pull them out of wherever they currently render inside the Today page tree and mount them at the top of the new Dashboard page, above everything else, unconditionally checked on every load.

2. **Status strip** (new, extracted from `HunterCard`) — see §3 for what this component contains.

3. **Daily board** — the rest of what's currently on Today:
   - `DailySummaryPanel`
   - `QuestSection`
   - `ChallengeSection`
   - No changes needed to these components themselves.

---

## 3. New `StatusStrip` component (extract from `HunterCard`)

`HunterCard` currently has 7 sections in one card. Split it:

**Stays in `HunterCard` (moves to `/profile`):**
- Identity section (avatar, name, rank badge, active title, achievement pill, partial-load-error banner)
- Full rank-progress bar + criteria checklist
- `StatsRadarChart` + 5-column CountUp readout
- AI/local insight quote (full text)
- 2-col quests/challenges done-today grid *(consider: this might belong on Dashboard instead — see open question below)*

**Extract into new `StatusStrip` (renders on Dashboard):**
- Compact rank-progress bar (no criteria checklist — just the bar + percentage)
- Streak counter with at-risk/on-fire pulse (this can reuse `RiskIndicators` if the visual matches, or be a simplified inline version)
- "Next objective" panel (animated, single next-quest preview)

Implementation approach: rather than duplicating markup, extract the streak/progress-bar/next-objective JSX into a shared sub-component that both `HunterCard` (full) and `StatusStrip` (compact) can compose, with a `variant="full" | "compact"` prop if the visual treatment differs meaningfully, or just two separate lightweight components if they diverge enough not to share code cleanly. Use your judgment on which is less awkward once you're in the code — don't force a shared abstraction if it makes both harder to read.

---

## 4. Profile page (`/profile`) — composition

Everything remaining in `HunterCard` after the extraction above, plus:
- `SystemFeed` (system log) — stays here, this is "checking your full history," not moment-to-moment
- Keep the existing `Promise.allSettled` parallel-fetch pattern for stats/quests/challenges/penalty/rank-progress — no changes to data-fetching logic, just to what's rendered where

---

## 5. Header / nav changes (`Header` component)

Nav tabs reorder — Dashboard first since it's now home:

**Before:** Profile · Today · History · Analytics · Titles
**After:** Dashboard · Profile · History · Analytics · Titles

- `Header`'s root-path active-state logic needs updating: `/` now matches "Dashboard" tab instead of "Profile" tab.
- No other changes to `Header` needed for this pass (the blur-effect bug fix and cyan-accent work belong to the theming spec, not this one).

---

## 6. Open questions to resolve before implementing

1. **Quests/challenges done-today grid** (currently in `HunterCard`) — this is arguably alert-adjacent/actionable-adjacent rather than pure identity. Options: (a) leave on Profile as a summary stat, (b) fold into Dashboard's Daily board section since it's about today's actions specifically. Recommendation: (b) — it's about *today*, which is the Dashboard's whole job.
2. **`RewardsPanel`** (flagged as likely-unused legacy in the current-state doc) — worth confirming dead before this restructure, since if it's actually wired to something, this is the moment it'd surface as broken.
3. **Redirect vs delete for old `/dashboard` route** — depends on whether anything external links to it (bookmarks, PWA shortcuts, etc.).

---

## 7. Suggested implementation order

1. Create `StatusStrip` component by extracting the relevant JSX out of `HunterCard`.
2. Build new `/` page: alert layer + `StatusStrip` + daily board sections (moved from old Today page).
3. Move remaining `HunterCard` content + `SystemFeed` to new `/profile` route.
4. Update `Header` nav order and active-state routing logic.
5. Add redirect from old `/dashboard` to `/` if needed.
6. Resolve the quests/challenges grid placement (§6.1) and confirm `RewardsPanel` status (§6.2).
7. Manual pass through all 5 gated routes to confirm nothing broke in the `QuestProvider`/`ChallengeProvider` context wiring that `/dashboard` used to own.
