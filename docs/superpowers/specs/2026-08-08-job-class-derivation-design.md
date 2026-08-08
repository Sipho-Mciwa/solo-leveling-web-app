# Job Class Derivation — Design

## Problem

The Profile page's Hunter Details panel shows a "Job Class" (Fighter / Assassin /
Mage / Tank / Ranger / Healer) right next to the stat radar chart (PHY / SPD /
STAMINA / DISCIPLINE / INTELLECT). Today, `frontend/lib/hunterDetails.ts:91`
picks Job Class as a random cosmetic value seeded off the user's id — it has no
relationship to the stats displayed a few inches away. This reads as arbitrary
rather than earned.

## Decision

Job Class stays purely cosmetic (no XP/gameplay effect) but is now **derived
live from whichever stat is currently highest**, recalculated on every Profile
load. A manually-set `profile.jobClass` (the existing backend-script override
pattern used for other hunter-sheet fields) still takes precedence over the
derived value.

## Stat → Class mapping

| Highest stat | Job Class |
|---|---|
| PHY | Fighter |
| SPD | Assassin |
| STAMINA | Tank |
| INTELLECT | Mage |
| DISCIPLINE | Ranger |
| *(no clear leader)* | Healer |

"No clear leader" means the gap between the top and second-highest stat is
less than `BALANCE_THRESHOLD = 5` points (on the 0–100 scale). This single
rule also covers exact ties between two or more stats, and a brand-new
account with all stats at 0 (gap of 0) — both land on Healer, which reads
fine as a starting/support archetype rather than an arbitrary default.

## Implementation

**`frontend/lib/hunterDetails.ts`** — add:

```ts
const STAT_TO_CLASS: Record<'PHY' | 'SPD' | 'STAMINA' | 'INTELLECT' | 'DISCIPLINE', string> = {
  PHY: 'Fighter', SPD: 'Assassin', STAMINA: 'Tank', INTELLECT: 'Mage', DISCIPLINE: 'Ranger',
};
const BALANCE_THRESHOLD = 5;

function deriveJobClass(stats: HunterStats): string {
  const entries = STAT_ORDER.map((key) => [key, stats[key]] as const).sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];
  const [, secondVal] = entries[1];
  if (topVal - secondVal < BALANCE_THRESHOLD) return 'Healer';
  return STAT_TO_CLASS[topKey];
}
```

`getHunterDetails` gains a 4th parameter, `stats: HunterStats | null`.
Resolution order for the `jobClass` field becomes:

```ts
jobClass: profile.jobClass ?? (stats ? deriveJobClass(stats) : '—'),
```

The `'—'` placeholder only shows during the brief window before `HunterCard`
finishes fetching stats — mirroring how `weakestStat` already goes `null`
during that same load window.

`isPlaceholder` / `hasRealDetails` are unchanged: they only check whether
`profile.jobClass` was explicitly set, not how the fallback was computed, so
this still works the same as it does for height/weight/sex/etc.

**`frontend/components/HunterCard.tsx:77`** — pass the already-in-scope
`stats` value as the 4th argument to `getHunterDetails`.

**Note:** `STAT_ORDER` and the `HunterStats` type already live in
`frontend/components/StatsRadarChart.tsx` and `frontend/lib/api.ts`
respectively — `hunterDetails.ts` imports both rather than redefining them.

## Testing

Update `frontend/lib/__tests__/hunterDetails.test.ts`:
- Pass a `stats` argument (or `null`) to every existing `getHunterDetails` call.
- One test per stat being the clear leader → correct class.
- One test for a balanced stat spread (gap < 5) → Healer.
- One test for all-zero stats (new account) → Healer.
- One test confirming `profile.jobClass` override still wins over the derived value even when stats are present.
- One test confirming `'—'` shows when `stats` is `null`.

## Out of scope

- No gameplay/XP effects tied to class (parked as a possible future direction,
  not part of this change).
- No UI for manually editing `jobClass` from the Profile page — the existing
  backend-script override pattern is unchanged.
