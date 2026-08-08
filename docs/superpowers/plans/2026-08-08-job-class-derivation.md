# Job Class Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Profile page's "Job Class" field a live-derived cosmetic label based on the user's highest stat, instead of a random per-user pick.

**Architecture:** A pure function `deriveJobClass(stats)` is added to `frontend/lib/hunterDetails.ts`. `getHunterDetails` gains a 4th parameter (`stats: HunterStats | null`) and uses it as the fallback when `profile.jobClass` isn't manually set. The single call site, `HunterCard.tsx`, passes its already-fetched `stats` value through.

**Tech Stack:** TypeScript, Vitest (existing test runner for `frontend/lib/__tests__`).

## Global Constraints

- Job Class is cosmetic only — no XP/gameplay effects (per spec: "Out of scope").
- `BALANCE_THRESHOLD = 5` (points on the 0–100 stat scale) — gap below this between the top two stats means "no clear leader".
- Manual `profile.jobClass` override always wins over the derived value — this is existing behavior and must not change.
- `isPlaceholder`/`hasRealDetails` computation is unchanged — it only checks whether `profile.jobClass` was explicitly set.
- No new UI for editing `jobClass` — out of scope per spec.

---

### Task 1: Add `deriveJobClass` and wire it into `getHunterDetails`

**Files:**
- Modify: `frontend/lib/hunterDetails.ts`
- Modify: `frontend/components/HunterCard.tsx:77`
- Test: `frontend/lib/__tests__/hunterDetails.test.ts`

**Interfaces:**
- Consumes: `STAT_ORDER` (exported from `frontend/components/StatsRadarChart.tsx`, type `StatKey[]`, value `['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT']`); `HunterStats` (exported from `frontend/lib/api.ts`, shape `{ PHY: number; SPD: number; STAMINA: number; DISCIPLINE: number; INTELLECT: number; delta: StatDelta }`).
- Produces: `getHunterDetails(userId: string, displayName: string | null | undefined, profile: UserProfile, stats: HunterStats | null): HunterDetails` — signature changes from 3 to 4 params. `HunterDetails.jobClass` is still `string`, now resolved as `profile.jobClass ?? (stats ? deriveJobClass(stats) : '—')`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/lib/__tests__/hunterDetails.test.ts` with:

```ts
import { describe, test, expect } from 'vitest';
import { getHunterDetails } from '../hunterDetails';
import { UserProfile, HunterStats } from '../api';

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'sipho@example.com',
    xp: 0,
    level: 1,
    streakCount: 0,
    lastActiveDate: null,
    rank: 'E',
    titles: [],
    activeTitle: null,
    ...overrides,
  };
}

function stats(overrides: Partial<Omit<HunterStats, 'delta'>> = {}): HunterStats {
  return {
    PHY: 0,
    SPD: 0,
    STAMINA: 0,
    DISCIPLINE: 0,
    INTELLECT: 0,
    delta: { PHY: 0, SPD: 0, STAMINA: 0, DISCIPLINE: 0, INTELLECT: 0 },
    ...overrides,
  };
}

describe('getHunterDetails', () => {
  test('is deterministic for the same user id', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    const b = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(a).toEqual(b);
  });

  test('differs across user ids', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    const b = getHunterDetails('user-2', 'Sipho Mciwa', baseProfile(), stats());
    // Not every field is guaranteed to differ, but the whole placeholder set
    // being identical between two different users would indicate the seed
    // isn't actually doing anything.
    expect(a).not.toEqual(b);
  });

  test('splits the display name into first/last', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.firstName).toBe('Sipho');
    expect(details.lastName).toBe('Mciwa');
  });

  test('falls back to "Hunter" with no display name', () => {
    const details = getHunterDetails('user-1', null, baseProfile(), stats());
    expect(details.firstName).toBe('Hunter');
    expect(details.lastName).toBe('');
  });

  test('marks placeholder fields as unverified', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.isPlaceholder).toBe(true);
  });

  test('prefers real profile values over placeholders once set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({
      height: '180 cm',
      dateOfBirth: '1999-12-17',
      weight: '75 kg',
      sex: 'Male',
      jobClass: 'Fighter',
    }), stats());
    expect(details.height).toBe('180 cm');
    expect(details.weight).toBe('75 kg');
    expect(details.sex).toBe('Male');
    expect(details.jobClass).toBe('Fighter');
    expect(details.isPlaceholder).toBe(false);
  });

  test('computes age from dateOfBirth as of today, not a stored number', () => {
    // A birthday that lands exactly today, N years ago — age is
    // deterministic regardless of when this test runs.
    const now = new Date();
    const dob = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate());
    const iso = dob.toISOString().slice(0, 10);

    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({ dateOfBirth: iso }), stats());
    expect(details.age).toBe(30);
  });

  test('falls back to a placeholder age when dateOfBirth is not set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.age).toBeGreaterThanOrEqual(18);
    expect(details.age).toBeLessThanOrEqual(35);
  });

  test('hunter ID is a stable HTR-###### code derived from the user id', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.hunterId).toMatch(/^HTR-\d{6}$/);
  });

  test('prefers a real profile hunterId over the derived placeholder', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({
      hunterId: 'HTR-171299',
    }), stats());
    expect(details.hunterId).toBe('HTR-171299');
    expect(details.isPlaceholder).toBe(false);
  });

  describe('jobClass derivation', () => {
    test('derives Fighter when PHY is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, SPD: 20, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Fighter');
    });

    test('derives Assassin when SPD is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 80, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Assassin');
    });

    test('derives Tank when STAMINA is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 80, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Tank');
    });

    test('derives Mage when INTELLECT is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 80 }));
      expect(details.jobClass).toBe('Mage');
    });

    test('derives Ranger when DISCIPLINE is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 20, DISCIPLINE: 80, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Ranger');
    });

    test('derives Healer when the top two stats are within the balance threshold', () => {
      // Gap of 4 between top two (60 vs 56) is below BALANCE_THRESHOLD (5)
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 60, SPD: 56, STAMINA: 10, DISCIPLINE: 10, INTELLECT: 10 }));
      expect(details.jobClass).toBe('Healer');
    });

    test('derives Healer for a brand-new account with all stats at 0', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats());
      expect(details.jobClass).toBe('Healer');
    });

    test('a manual profile.jobClass override wins over the derived value', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile({ jobClass: 'Mage' }), stats({ PHY: 90, SPD: 10, STAMINA: 10, DISCIPLINE: 10, INTELLECT: 10 }));
      expect(details.jobClass).toBe('Mage');
    });

    test('shows a loading placeholder when stats have not loaded yet', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), null);
      expect(details.jobClass).toBe('—');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run lib/__tests__/hunterDetails.test.ts`
Expected: FAIL — `getHunterDetails` called with 4 arguments but only accepts 3 (TypeScript error) and/or the `jobClass derivation` tests fail because `deriveJobClass` doesn't exist yet.

- [ ] **Step 3: Implement `deriveJobClass` and update `getHunterDetails`**

In `frontend/lib/hunterDetails.ts`, add the import and new logic. The file's imports become:

```ts
import { UserProfile, HunterStats } from './api';
import { STAT_ORDER } from '@/components/StatsRadarChart';
```

Add this after the existing `JOB_CLASSES` constant (leave `JOB_CLASSES` in place — it's still used as the placeholder-loading random pool is removed, so `JOB_CLASSES` becomes dead code; delete it along with the `pick` calls that used it for jobClass, but keep `pick` itself since it's still used for `SEXES`):

```ts
const STAT_TO_CLASS: Record<'PHY' | 'SPD' | 'STAMINA' | 'INTELLECT' | 'DISCIPLINE', string> = {
  PHY: 'Fighter',
  SPD: 'Assassin',
  STAMINA: 'Tank',
  INTELLECT: 'Mage',
  DISCIPLINE: 'Ranger',
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

Remove the line `const JOB_CLASSES = ['Fighter', 'Assassin', 'Mage', 'Tank', 'Ranger', 'Healer'];` (no longer used — `STAT_TO_CLASS` plus the `'Healer'` literal in `deriveJobClass` cover all six).

Update the `getHunterDetails` function signature and body:

```ts
export function getHunterDetails(
  userId: string,
  displayName: string | null | undefined,
  profile: UserProfile,
  stats: HunterStats | null,
): HunterDetails {
  const rand = mulberry32(seedFromString(userId));
  const [fallbackFirst, fallbackLast] = splitDisplayName(displayName);

  const hasRealDetails = Boolean(
    profile.height || profile.dateOfBirth || profile.weight || profile.sex || profile.jobClass || profile.hunterId
  );

  return {
    firstName: profile.firstName ?? fallbackFirst,
    lastName:  profile.lastName  ?? fallbackLast,
    height:    profile.height    ?? `${inRange(rand, 160, 195)} cm`,
    age:       profile.dateOfBirth ? computeAge(profile.dateOfBirth) : inRange(rand, 18, 35),
    weight:    profile.weight    ?? `${inRange(rand, 55, 95)} kg`,
    sex:       profile.sex       ?? pick(rand, SEXES),
    jobClass:  profile.jobClass  ?? (stats ? deriveJobClass(stats) : '—'),
    hunterId:  profile.hunterId  ?? `HTR-${(seedFromString(userId) % 1_000_000).toString().padStart(6, '0')}`,
    isPlaceholder: !hasRealDetails,
  };
}
```

- [ ] **Step 4: Update the call site in `HunterCard.tsx`**

In `frontend/components/HunterCard.tsx`, change line 77 from:

```ts
  const details = getHunterDetails(uid, displayName, userProfile);
```

to:

```ts
  const details = getHunterDetails(uid, displayName, userProfile, stats);
```

(`stats` is already in scope from the `useState<HunterStats | null>(null)` declared earlier in the component — no other changes needed in this file.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run lib/__tests__/hunterDetails.test.ts`
Expected: PASS — all tests including the new `jobClass derivation` describe block.

- [ ] **Step 6: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (confirms `HunterCard.tsx`'s call site and the `HunterStats`/`STAT_ORDER` imports are all correctly typed).

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/hunterDetails.ts frontend/components/HunterCard.tsx frontend/lib/__tests__/hunterDetails.test.ts
git commit -m "$(cat <<'EOF'
feat: derive Job Class from highest stat instead of random pick

Job Class now reflects whichever of PHY/SPD/STAMINA/DISCIPLINE/INTELLECT
is currently highest, recalculated live on every Profile load. A
balanced spread (or a brand-new all-zero account) falls back to Healer.
Manual profile.jobClass overrides are unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Manual Verification (after Task 1)

Since this is a UI-visible change, confirm it in the running app before considering the feature done:

1. With the dev servers running (`frontend` on `next dev`, `backend` on `nodemon`), open the Profile page for the real account (`Ng82vlN0bIMVIXdg9DIuH98NzJy2`, Level 6).
2. Compare the "Job Class" value shown against the stat radar chart's highest bar for that account — confirm they match per the mapping table in the spec.
3. Confirm no `'—'` flash-of-placeholder is visually jarring — if stats load within a few hundred ms (typical), the placeholder should barely be visible.
