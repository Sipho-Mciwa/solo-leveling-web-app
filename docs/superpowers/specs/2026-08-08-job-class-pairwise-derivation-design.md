# Job Class Pairwise Derivation — Design

## Problem

`docs/superpowers/specs/2026-08-08-job-class-derivation-design.md` shipped
Job Class as a live derivation from the user's single highest stat, with a
`'Healer'` fallback whenever the top two stats were within
`BALANCE_THRESHOLD` (5 points) of each other. In practice this produces
nonsensical results: a user with tied SPD and STAMINA (speed + endurance)
was labeled "Healer," a class unrelated to either stat. A single fallback
class can't represent every possible pair of tied stats.

## Decision

Replace the single-stat-or-Healer rule with a three-tier rule that can
express a genuine two-stat tie as its own class, and reserves a new
`'Unclassified'` label for the case where no two stats stand out at all.

1. **Clear leader** (gap between 1st and 2nd stat ≥ `BALANCE_THRESHOLD`):
   single-stat class, unchanged from the original design.
2. **Exactly two stats tied at the top** (gap between 1st/2nd <
   `BALANCE_THRESHOLD`, but gap between 2nd/3rd ≥ `BALANCE_THRESHOLD`): a new
   pair-lookup table maps the two tied stats to a dedicated hybrid class.
3. **Three or more stats bunched at the top** (gap between 1st/2nd AND
   2nd/3rd both < `BALANCE_THRESHOLD`): the profile is genuinely flat —
   returns `'Unclassified'`. This also covers a brand-new account with all
   stats at 0.

`'Healer'` is removed entirely — it never appears in the new tier set.

## Stat → Class mapping (single stats, unchanged except one swap)

| Stat | Class |
|---|---|
| PHY | Fighter |
| SPD | Scout |
| STAMINA | Tank |
| INTELLECT | Mage |
| DISCIPLINE | Ranger |

(SPD was originally "Assassin" in the prior design; swapped to "Scout" so
"Assassin" is free for the SPD+STAMINA pair below.)

## Pair → Class mapping (new)

| Pair | Class |
|---|---|
| PHY + SPD | Berserker |
| PHY + STAMINA | Juggernaut |
| PHY + DISCIPLINE | Knight |
| PHY + INTELLECT | Spellblade |
| SPD + STAMINA | Assassin |
| SPD + DISCIPLINE | Duelist |
| SPD + INTELLECT | Trickster |
| STAMINA + DISCIPLINE | Sentinel |
| STAMINA + INTELLECT | Warden |
| DISCIPLINE + INTELLECT | Sage |

All 10 combinations of the 5 stats are covered — no pair falls through to a
generic default. Naming stays single-word archetype style, consistent with
the existing classes and the app's terse System-voice tone
(`backend/services/systemVoice.js`).

## "Unclassified" replaces "Healer"

`'Healer'` implied a specific archetype (support/recovery) that has no
relationship to a flat stat profile. `'Unclassified'` reads as "the System
hasn't been able to categorize you yet" — consistent with the clinical,
non-narrative tone used elsewhere in System-generated text (Insufficient,
Stable, Critical, etc. — see `systemVoice.js`'s approved vocabulary), and
correctly signals "no data / no dominant trait" rather than assigning an
unrelated archetype.

## Implementation

**`frontend/lib/hunterDetails.ts`** — replace `STAT_TO_CLASS` and
`deriveJobClass` with:

```ts
const STAT_TO_CLASS: Record<'PHY' | 'SPD' | 'STAMINA' | 'INTELLECT' | 'DISCIPLINE', string> = {
  PHY: 'Fighter',
  SPD: 'Scout',
  STAMINA: 'Tank',
  INTELLECT: 'Mage',
  DISCIPLINE: 'Ranger',
};

const PAIR_TO_CLASS: Record<string, string> = {
  'PHY|SPD': 'Berserker',
  'PHY|STAMINA': 'Juggernaut',
  'PHY|DISCIPLINE': 'Knight',
  'PHY|INTELLECT': 'Spellblade',
  'SPD|STAMINA': 'Assassin',
  'SPD|DISCIPLINE': 'Duelist',
  'SPD|INTELLECT': 'Trickster',
  'STAMINA|DISCIPLINE': 'Sentinel',
  'STAMINA|INTELLECT': 'Warden',
  'DISCIPLINE|INTELLECT': 'Sage',
};

const BALANCE_THRESHOLD = 5;

function pairKey(a: StatKey, b: StatKey): string {
  const [x, y] = STAT_ORDER.indexOf(a) < STAT_ORDER.indexOf(b) ? [a, b] : [b, a];
  return `${x}|${y}`;
}

function deriveJobClass(stats: HunterStats): string {
  const entries = STAT_ORDER.map((key) => [key, stats[key]] as const).sort((a, b) => b[1] - a[1]);
  const [firstKey, firstVal] = entries[0];
  const [secondKey, secondVal] = entries[1];
  const [, thirdVal] = entries[2];

  if (firstVal - secondVal >= BALANCE_THRESHOLD) return STAT_TO_CLASS[firstKey];
  if (secondVal - thirdVal < BALANCE_THRESHOLD) return 'Unclassified';
  return PAIR_TO_CLASS[pairKey(firstKey, secondKey)];
}
```

`pairKey` canonicalizes the two-stat key using each stat's index in the
existing `STAT_ORDER` array (`['PHY', 'SPD', 'STAMINA', 'DISCIPLINE',
'INTELLECT']`) so `pairKey('STAMINA', 'SPD')` and `pairKey('SPD',
'STAMINA')` both produce `'SPD|STAMINA'` — the table only needs one entry
per pair.

`getHunterDetails`'s resolution order is unchanged:
`profile.jobClass ?? (stats ? deriveJobClass(stats) : '—')`. The manual
override, `isPlaceholder`/`hasRealDetails` logic, and the `'—'` loading
placeholder for null stats are all untouched by this revision.

## Testing

Update `frontend/lib/__tests__/hunterDetails.test.ts`'s `jobClass
derivation` block:
- Update the SPD-clear-leader test to expect `'Scout'` (was `'Assassin'`).
- Remove the old "balanced stats → Healer" and "all-zero stats → Healer"
  tests; replace with:
  - One test per pair (10 total) — two stats tied at the top, third stat
    clearly behind → correct pair class.
  - One test where 3 stats are bunched at the top → `'Unclassified'`.
  - One test for all-zero stats (new account) → `'Unclassified'`.
- Keep the existing manual-override and null-stats-placeholder tests
  unchanged (still pass `stats` objects with a clear leader or omit them).

## Out of scope

- Still cosmetic only — no XP/gameplay effects (unchanged from the prior
  design).
- No UI for manually editing `jobClass` — unchanged.
- No change to the `BALANCE_THRESHOLD` value (still 5).
