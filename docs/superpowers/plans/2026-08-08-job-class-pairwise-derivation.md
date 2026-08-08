# Job Class Pairwise Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-stat-or-Healer Job Class rule with a four-tier rule: clear leader → single-stat class, exactly two stats tied → dedicated pair class, 3+ stats bunched with a high average → `'Player'`, 3+ stats bunched with a low average → `'Unclassified'`.

**Architecture:** All changes are confined to the existing `deriveJobClass` function and its supporting constants in `frontend/lib/hunterDetails.ts`. No signature changes to `getHunterDetails` — this revises only what happens *inside* the fallback branch already wired up in the prior Job Class derivation feature.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- `BALANCE_THRESHOLD = 5` — unchanged from the prior design.
- `ELITE_THRESHOLD = 85` — new constant; average of all 5 stats must be `>=` this (not `>`) to return `'Player'`.
- `'Healer'` must not appear anywhere in the new code or tests — fully removed.
- Job Class remains cosmetic only — no XP/gameplay effects.
- Manual `profile.jobClass` override behavior, `isPlaceholder`/`hasRealDetails` computation, and the `'—'` loading placeholder for null stats are all unchanged — this task only touches `deriveJobClass`'s internals.

---

### Task 1: Replace the balance-fallback with pair lookup + elite/unclassified split

**Files:**
- Modify: `frontend/lib/hunterDetails.ts`
- Test: `frontend/lib/__tests__/hunterDetails.test.ts`

**Interfaces:**
- Consumes: `StatKey` (exported type from `frontend/components/StatsRadarChart.tsx`, alongside the already-imported `STAT_ORDER`).
- Produces: `deriveJobClass(stats: HunterStats): string` — same signature as before, only its internal logic and possible return values change. Callers (`getHunterDetails`) are unaffected and require no changes.

- [ ] **Step 1: Write the failing tests**

In `frontend/lib/__tests__/hunterDetails.test.ts`, replace the `'derives Assassin when SPD is the clear leader'` test (currently at lines 116-119) with:

```ts
    test('derives Scout when SPD is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 80, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Scout');
    });
```

Then replace the two Healer tests (currently at lines 136-145: `'derives Healer when the top two stats are within the balance threshold'` and `'derives Healer for a brand-new account with all stats at 0'`) with:

```ts
    test('derives Berserker when PHY and SPD are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, SPD: 80, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Berserker');
    });

    test('derives Juggernaut when PHY and STAMINA are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, STAMINA: 80, SPD: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Juggernaut');
    });

    test('derives Knight when PHY and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, DISCIPLINE: 80, SPD: 20, STAMINA: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Knight');
    });

    test('derives Spellblade when PHY and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, INTELLECT: 80, SPD: 20, STAMINA: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Spellblade');
    });

    test('derives Assassin when SPD and STAMINA are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, STAMINA: 80, PHY: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Assassin');
    });

    test('derives Duelist when SPD and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, DISCIPLINE: 80, PHY: 20, STAMINA: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Duelist');
    });

    test('derives Trickster when SPD and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, INTELLECT: 80, PHY: 20, STAMINA: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Trickster');
    });

    test('derives Sentinel when STAMINA and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ STAMINA: 80, DISCIPLINE: 80, PHY: 20, SPD: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Sentinel');
    });

    test('derives Warden when STAMINA and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ STAMINA: 80, INTELLECT: 80, PHY: 20, SPD: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Warden');
    });

    test('derives Sage when DISCIPLINE and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ DISCIPLINE: 80, INTELLECT: 80, PHY: 20, SPD: 20, STAMINA: 20 }));
      expect(details.jobClass).toBe('Sage');
    });

    test('derives Unclassified when 3+ stats are bunched at the top with a low average', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 18, STAMINA: 16, DISCIPLINE: 5, INTELLECT: 5 }));
      expect(details.jobClass).toBe('Unclassified');
    });

    test('derives Unclassified for a brand-new account with all stats at 0', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats());
      expect(details.jobClass).toBe('Unclassified');
    });

    test('derives Player when 3+ stats are bunched at the top with a high average', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 99, SPD: 97, STAMINA: 95, DISCIPLINE: 90, INTELLECT: 90 }));
      expect(details.jobClass).toBe('Player');
    });

    test('derives Player at exactly the elite threshold average (boundary is inclusive)', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 85, SPD: 85, STAMINA: 85, DISCIPLINE: 85, INTELLECT: 85 }));
      expect(details.jobClass).toBe('Player');
    });
```

Leave every other test in the file (the non-`jobClass derivation` tests, and the manual-override/null-stats tests inside `jobClass derivation`) exactly as-is.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run lib/__tests__/hunterDetails.test.ts`
Expected: FAIL — the renamed Scout test and all 14 new pair/Unclassified/Player tests fail because `deriveJobClass` still returns the old single-stat-or-Healer values (e.g. `'Assassin'` for SPD-alone, `'Healer'` for ties).

- [ ] **Step 3: Implement the new derivation logic**

In `frontend/lib/hunterDetails.ts`, change the import on line 2 from:

```ts
import { STAT_ORDER } from '@/components/StatsRadarChart';
```

to:

```ts
import { STAT_ORDER, StatKey } from '@/components/StatsRadarChart';
```

Replace the entire block from `const STAT_TO_CLASS` through the end of `deriveJobClass` (currently lines 72-87) with:

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
const ELITE_THRESHOLD = 85;

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
  if (secondVal - thirdVal >= BALANCE_THRESHOLD) return PAIR_TO_CLASS[pairKey(firstKey, secondKey)];

  const average = STAT_ORDER.reduce((sum, key) => sum + stats[key], 0) / STAT_ORDER.length;
  return average >= ELITE_THRESHOLD ? 'Player' : 'Unclassified';
}
```

Do not change anything else in the file — `getHunterDetails` calls `deriveJobClass(stats)` exactly as before and needs no edits.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/__tests__/hunterDetails.test.ts`
Expected: PASS — all tests, including the renamed Scout test and all 14 new tests.

- [ ] **Step 5: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/hunterDetails.ts frontend/lib/__tests__/hunterDetails.test.ts
git commit -m "$(cat <<'EOF'
feat: derive Job Class from stat pairs instead of a Healer fallback

A tied top-two stats (e.g. SPD+STAMINA) now maps to a dedicated hybrid
class (e.g. Assassin) instead of the unrelated 'Healer' fallback. A
genuinely flat profile (3+ stats bunched together) now splits on
average stat value: 'Player' for an elite, maxed-out hunter, or
'Unclassified' for a brand-new account -- previously both cases
produced the same 'Healer' label.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Manual Verification (after Task 1)

Since this changes a UI-visible label, confirm it in the running app before considering the feature done:

1. With the dev servers running, open the Profile page for the real account (`Ng82vlN0bIMVIXdg9DIuH98NzJy2`, Level 6) whose tied SPD/STAMINA prompted this change.
2. Confirm the Job Class now reads "Assassin" instead of "Healer".
3. Confirm no `'—'` flash-of-placeholder regression (unrelated to this task, but a quick sanity check costs nothing).
