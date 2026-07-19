# Solo Leveling IA Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the app's information architecture so `/` becomes the new "Dashboard" (interrupt layer: alerts + status strip + daily board) and `/profile` becomes the new "Status window" (identity, full rank progress, stats, AI insight, system feed), per `solo-leveling-ia-restructure-spec.md`.

**Architecture:** Extract three pieces of shared JSX out of `HunterCard` (`RankProgressBar`, `StreakPanel`, `NextObjectiveCard`) so both the full Profile card and the new compact `StatusStrip` can reuse them via a `variant` prop instead of duplicating markup. Move `QuestProvider`/`ChallengeProvider` from `/dashboard` to `/`. Old `/dashboard` becomes a redirect to `/`.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind, framer-motion, Vitest + React Testing Library.

Source of truth: `solo-leveling-ia-restructure-spec.md` (repo root). This plan implements it exactly; deviations are called out inline.

## Global Constraints

- No new visual design in this pass — reuse existing classNames/tokens verbatim when moving JSX. Visual/theming changes belong to the separate UI revamp plan (`2026-07-19-ui-revamp.md`).
- Do not change any data-fetching logic (`Promise.allSettled` pattern in `HunterCard`, direct API calls) — only change what renders where.
- Keep `HunterCard`'s existing prop-less, `useAuth()`-driven design; new shared components take explicit props (no hidden context reads) so they're usable from both `HunterCard` and `StatusStrip`.
- Every task must leave `npm run build` and `npm test` (run from `frontend/`) green before moving to the next task.
- Nav tabs after this plan: `Dashboard (/) · Profile (/profile) · History (/history) · Analytics (/analytics) · Titles (/titles)`.

---

### Task 1: Extract `RankProgressBar` shared component

**Files:**
- Create: `frontend/components/RankProgressBar.tsx`
- Test: `frontend/components/__tests__/RankProgressBar.test.tsx`
- Modify: `frontend/components/HunterCard.tsx:229-275` (replace inline rank-progress JSX with the new component)

**Interfaces:**
- Produces: `RankProgressBar({ rank: Rank, rankProgress: RankProgress | null, variant: 'full' | 'compact' }): JSX.Element`. `'full'` renders the criteria checklist below the bar; `'compact'` renders only the bar + percentage line.
- Consumes (Task 1): `Rank`, `RankProgress` types from `@/lib/api` (already imported in `HunterCard.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/__tests__/RankProgressBar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RankProgressBar from '../RankProgressBar';

const rankProgress = {
  metCount: 2,
  totalCount: 4,
  nextRank: 'C' as const,
  criteria: [
    { label: '10 quests completed', met: true, current: 10, target: 10 },
    { label: '5 streak days', met: false, current: 2, target: 5 },
  ],
};

describe('RankProgressBar', () => {
  it('renders criteria checklist in full variant', () => {
    render(<RankProgressBar rank="D" rankProgress={rankProgress} variant="full" />);
    expect(screen.getByText('10 quests completed')).toBeInTheDocument();
    expect(screen.getByText('2/4 conditions met for C-Rank')).toBeInTheDocument();
  });

  it('omits criteria checklist in compact variant', () => {
    render(<RankProgressBar rank="D" rankProgress={rankProgress} variant="compact" />);
    expect(screen.queryByText('10 quests completed')).not.toBeInTheDocument();
    expect(screen.getByText('2/4 conditions met for C-Rank')).toBeInTheDocument();
  });

  it('shows max-rank message when nextRank is null', () => {
    render(<RankProgressBar rank="S" rankProgress={{ ...rankProgress, nextRank: null }} variant="compact" />);
    expect(screen.getByText('Max rank achieved')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run components/__tests__/RankProgressBar.test.tsx`
Expected: FAIL — `Cannot find module '../RankProgressBar'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/components/RankProgressBar.tsx
'use client';

import { motion } from 'framer-motion';
import { Rank, RankProgress } from '@/lib/api';

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-gray-400',
  D: 'text-green-400',
  C: 'text-blue-400',
  B: 'text-purple-400',
  A: 'text-yellow-400',
  S: 'text-red-400',
};

interface RankProgressBarProps {
  rank: Rank;
  rankProgress: RankProgress | null;
  variant: 'full' | 'compact';
}

export default function RankProgressBar({ rank, rankProgress, variant }: RankProgressBarProps) {
  const rankMetCount   = rankProgress?.metCount   ?? 0;
  const rankTotalCount = rankProgress?.totalCount ?? 0;
  const rankNextRank   = rankProgress?.nextRank   ?? null;
  const rankPct        = rankTotalCount > 0 ? (rankMetCount / rankTotalCount) * 100 : 100;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold ${RANK_STYLES[rank ?? 'E']}`}>{rank}</span>
        <div className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${rankPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            style={{
              background:
                rankNextRank == null
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            }}
          />
        </div>
        {rankNextRank && (
          <span className={`text-[11px] font-bold ${RANK_STYLES[rankNextRank]}`}>
            {rankNextRank}
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted mt-1 text-right">
        {rankNextRank == null
          ? 'Max rank achieved'
          : rankProgress
          ? `${rankMetCount}/${rankTotalCount} conditions met for ${rankNextRank}-Rank`
          : `Working towards ${rankNextRank}-Rank`}
      </p>
      {variant === 'full' && rankProgress && rankNextRank && rankProgress.criteria.length > 0 && (
        <div className="mt-2 space-y-1">
          {rankProgress.criteria.map((c) => (
            <div key={c.label} className="flex items-center justify-between text-[10px]">
              <span className={c.met ? 'text-green-400' : 'text-muted'}>
                {c.met ? '✓' : '·'} {c.label}
              </span>
              <span className={`tabular-nums ${c.met ? 'text-green-400' : 'text-muted'}`}>
                {c.current}/{c.target}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/__tests__/RankProgressBar.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire it into `HunterCard.tsx`**

In `frontend/components/HunterCard.tsx`, replace lines 229-275 (the `{/* Rank progress — criteria-based */}` block) with:

```tsx
<RankProgressBar rank={rank ?? 'E'} rankProgress={rankProgress} variant="full" />
```

Add the import near the other local component imports (line 24-26):

```tsx
import RankProgressBar from './RankProgressBar';
```

Remove the now-unused `RANK_STYLES` const (lines 36-43) and the `rankMetCount`/`rankTotalCount`/`rankNextRank`/`rankPct` locals (lines 116-119) from `HunterCard.tsx` — they're only consumed by the extracted component now. Keep `rankProgress` state itself (still passed as a prop).

- [ ] **Step 6: Run full test suite and build**

Run: `npm test && npm run build` (from `frontend/`)
Expected: all tests PASS, build succeeds with no unused-variable errors

- [ ] **Step 7: Commit**

```bash
git add frontend/components/RankProgressBar.tsx frontend/components/__tests__/RankProgressBar.test.tsx frontend/components/HunterCard.tsx
git commit -m "refactor: extract RankProgressBar from HunterCard for StatusStrip reuse"
```

---

### Task 2: Extract `StreakPanel` shared component

**Files:**
- Create: `frontend/components/StreakPanel.tsx`
- Test: `frontend/components/__tests__/StreakPanel.test.tsx`
- Modify: `frontend/components/HunterCard.tsx:338-428` (replace inline streak+pressure JSX)

**Interfaces:**
- Produces: `StreakPanel({ streakCount, streakAtRisk, activePenalty, showPressure, hoursLeft, minutesLeft, questsRemaining, variant }): JSX.Element`. `'compact'` renders only the streak counter + risk/fire pill. `'full'` additionally renders the penalty warning and time-pressure banners.
- Consumes: no external types beyond primitives.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/__tests__/StreakPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StreakPanel from '../StreakPanel';

describe('StreakPanel', () => {
  it('shows "At risk" pill when streak is at risk', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk
        activePenalty={false}
        showPressure={false}
        hoursLeft={10}
        minutesLeft={0}
        questsRemaining={1}
        variant="compact"
      />
    );
    expect(screen.getByText('At risk')).toBeInTheDocument();
  });

  it('does not render penalty/pressure banners in compact variant', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk={false}
        activePenalty
        showPressure
        hoursLeft={2}
        minutesLeft={30}
        questsRemaining={2}
        variant="compact"
      />
    );
    expect(screen.queryByText(/Penalty active/)).not.toBeInTheDocument();
  });

  it('renders penalty banner in full variant', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk={false}
        activePenalty
        showPressure={false}
        hoursLeft={10}
        minutesLeft={0}
        questsRemaining={0}
        variant="full"
      />
    );
    expect(screen.getByText(/Penalty active/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/StreakPanel.test.tsx`
Expected: FAIL — `Cannot find module '../StreakPanel'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/components/StreakPanel.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';

interface StreakPanelProps {
  streakCount: number;
  streakAtRisk: boolean;
  activePenalty: boolean;
  showPressure: boolean;
  hoursLeft: number;
  minutesLeft: number;
  questsRemaining: number;
  variant: 'full' | 'compact';
}

export default function StreakPanel({
  streakCount,
  streakAtRisk,
  activePenalty,
  showPressure,
  hoursLeft,
  minutesLeft,
  questsRemaining,
  variant,
}: StreakPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-sm font-bold text-white tabular-nums"
            animate={
              streakAtRisk
                ? { opacity: [1, 0.45, 1] }
                : streakCount >= 7
                ? { scale: [1, 1.08, 1] }
                : {}
            }
            transition={
              streakAtRisk || streakCount >= 7
                ? { repeat: Infinity, duration: streakAtRisk ? 1.1 : 2.2 }
                : {}
            }
          >
            <CountUp end={streakCount} duration={1.1} />
          </motion.span>
          <span className="text-xs text-muted">day streak</span>
        </div>

        <AnimatePresence mode="wait">
          {streakAtRisk ? (
            <motion.span
              key="risk"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
            >
              At risk
            </motion.span>
          ) : streakCount >= 7 ? (
            <motion.span
              key="fire"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className="text-[10px] font-semibold text-accent-light bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
            >
              On fire
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {variant === 'full' && (
        <>
          <AnimatePresence>
            {activePenalty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2"
              >
                <span className="text-xs font-semibold shrink-0">!</span>
                <p className="text-[11px] font-medium">
                  Penalty active — complete it to restore rank progress
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPressure && !activePenalty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-amber-400 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2"
              >
                <span className="text-xs shrink-0">⏱</span>
                <p className="text-[11px] font-medium">
                  {hoursLeft}h {minutesLeft}m left today — {questsRemaining} quest
                  {questsRemaining !== 1 ? 's' : ''} remaining
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/__tests__/StreakPanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire it into `HunterCard.tsx`**

Replace `HunterCard.tsx` lines 338-428 (the entire `{/* ── 5. Streak + pressure ── */}` `motion.div` block) with:

```tsx
<motion.div
  {...sectionVariant(0.21)}
  className="px-4 sm:px-6 py-4 border-t border-border"
>
  <StreakPanel
    streakCount={streakCount}
    streakAtRisk={streakAtRisk}
    activePenalty={!!activePenalty}
    showPressure={showPressure}
    hoursLeft={hLeft}
    minutesLeft={mLeft}
    questsRemaining={questsTotal - questsDone}
    variant="full"
  />
</motion.div>
```

Add the import: `import StreakPanel from './StreakPanel';`

- [ ] **Step 6: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/components/StreakPanel.tsx frontend/components/__tests__/StreakPanel.test.tsx frontend/components/HunterCard.tsx
git commit -m "refactor: extract StreakPanel from HunterCard for StatusStrip reuse"
```

---

### Task 3: Extract `NextObjectiveCard` and remove daily-snapshot grid from `HunterCard`

**Files:**
- Create: `frontend/components/NextObjectiveCard.tsx`
- Test: `frontend/components/__tests__/NextObjectiveCard.test.tsx`
- Modify: `frontend/components/HunterCard.tsx:278-336` (delete daily-snapshot grid section 3 entirely; replace next-objective section 4 with the new component)

**Interfaces:**
- Produces: `NextObjectiveCard({ quest: DailyQuest | null, ready: boolean }): JSX.Element | null`. Returns `null` when `!ready || !quest` (mirrors the `AnimatePresence` gating that existed inline).
- Consumes: `DailyQuest` type from `@/lib/api`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/__tests__/NextObjectiveCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NextObjectiveCard from '../NextObjectiveCard';

const quest = {
  id: 'q1',
  title: 'Run 5km',
  completed: false,
  currentValue: 2,
  targetValue: 5,
  currentTarget: 5,
} as any;

describe('NextObjectiveCard', () => {
  it('renders nothing when not ready', () => {
    const { container } = render(<NextObjectiveCard quest={quest} ready={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no next quest', () => {
    const { container } = render(<NextObjectiveCard quest={null} ready />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders quest title and remaining km for a running quest', () => {
    render(<NextObjectiveCard quest={quest} ready />);
    expect(screen.getByText('Run 5km')).toBeInTheDocument();
    expect(screen.getByText('3 km remaining')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/NextObjectiveCard.test.tsx`
Expected: FAIL — `Cannot find module '../NextObjectiveCard'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/components/NextObjectiveCard.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DailyQuest } from '@/lib/api';

interface NextObjectiveCardProps {
  quest: DailyQuest | null;
  ready: boolean;
}

export default function NextObjectiveCard({ quest, ready }: NextObjectiveCardProps) {
  if (!ready || !quest) return null;

  const target    = quest.currentTarget ?? quest.targetValue;
  const remaining = Math.max(0, target - quest.currentValue);

  return (
    <AnimatePresence>
      <motion.div
        key="next-obj"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
              Next objective
            </p>
            <p className="text-sm font-semibold text-white truncate">{quest.title}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted mb-1">&nbsp;</p>
            <p className="text-xs text-accent-light tabular-nums">
              {quest.currentValue} / {target}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-subtle overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent/60"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (quest.currentValue / target) * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[10px] text-muted mt-1">
          {remaining} {quest.title.toLowerCase().includes('run') ? 'km' : 'reps'} remaining
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/__tests__/NextObjectiveCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Remove section 3 (daily-snapshot grid) and rewire section 4 in `HunterCard.tsx`**

Delete `HunterCard.tsx` lines 278-296 (`{/* ── 3. Daily snapshot ── */}` block) entirely — this content moves to the Dashboard page in Task 6.

Replace lines 297-336 (`{/* ── 4. Next objective ── */}` block) with:

```tsx
<div className="px-4 sm:px-6 py-4 border-t border-border">
  <NextObjectiveCard quest={nextQuest} ready={questsReady} />
</div>
```

Add the import: `import NextObjectiveCard from './NextObjectiveCard';`

Note: wrapping in a fixed padded div here means the border/padding shows even when `NextObjectiveCard` returns `null`. Guard it in `HunterCard.tsx` instead:

```tsx
{questsReady && nextQuest && (
  <div className="px-4 sm:px-6 py-4 border-t border-border">
    <NextObjectiveCard quest={nextQuest} ready={questsReady} />
  </div>
)}
```

- [ ] **Step 6: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds (watch for now-unused `questsDone`/`questsTotal`/`challenges` locals in `HunterCard.tsx` — they're still used by `StreakPanel` props and JSX elsewhere, so no removal needed, but double check the compiler agrees)

- [ ] **Step 7: Commit**

```bash
git add frontend/components/NextObjectiveCard.tsx frontend/components/__tests__/NextObjectiveCard.test.tsx frontend/components/HunterCard.tsx
git commit -m "refactor: extract NextObjectiveCard, remove daily-snapshot grid from HunterCard"
```

---

### Task 4: Create `DailySnapshot` component (quests/challenges done-today grid, now context-driven)

Resolves spec §6.1: the quests/challenges done-today grid moves to the Dashboard's Daily board, fed by `useQuests()`/`useChallenges()` context instead of `HunterCard`'s private fetch.

**Files:**
- Create: `frontend/components/DailySnapshot.tsx`
- Test: `frontend/components/__tests__/DailySnapshot.test.tsx`

**Interfaces:**
- Produces: `DailySnapshot(): JSX.Element` — no props, reads `useQuests()` and `useChallenges()` directly (same pattern as `DailySummaryPanel`, `QuestSection`).
- Consumes: `useQuests` from `@/context/QuestContext`, `useChallenges` from `@/context/ChallengeContext`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/__tests__/DailySnapshot.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DailySnapshot from '../DailySnapshot';

vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({
    quests: [
      { id: '1', completed: true },
      { id: '2', completed: false },
    ],
  }),
}));

vi.mock('@/context/ChallengeContext', () => ({
  useChallenges: () => ({
    challengeDoc: {
      challenges: [{ key: 'a', completed: true }, { key: 'b', completed: true }, { key: 'c', completed: false }],
    },
  }),
}));

describe('DailySnapshot', () => {
  it('renders quests and challenges done-today counts', () => {
    render(<DailySnapshot />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/DailySnapshot.test.tsx`
Expected: FAIL — `Cannot find module '../DailySnapshot'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/components/DailySnapshot.tsx
'use client';

import { useQuests } from '@/context/QuestContext';
import { useChallenges } from '@/context/ChallengeContext';

export default function DailySnapshot() {
  const { quests } = useQuests();
  const { challengeDoc } = useChallenges();

  const questsDone      = quests.filter((q) => q.completed).length;
  const questsTotal     = quests.length;
  const challengesDone  = challengeDoc?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = challengeDoc?.challenges.length ?? 0;

  return (
    <div className="grid grid-cols-2 rounded-2xl border border-border bg-surface divide-x divide-border overflow-hidden mb-6">
      <div className="px-4 py-3 text-center">
        <p className="text-base font-bold text-white tabular-nums leading-none">
          {questsTotal > 0 ? `${questsDone}/${questsTotal}` : '—'}
        </p>
        <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Quests</p>
      </div>
      <div className="px-4 py-3 text-center">
        <p className="text-base font-bold text-white tabular-nums leading-none">
          {challengesTotal > 0 ? `${challengesDone}/${challengesTotal}` : '—'}
        </p>
        <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Challenges</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/__tests__/DailySnapshot.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/DailySnapshot.tsx frontend/components/__tests__/DailySnapshot.test.tsx
git commit -m "feat: add DailySnapshot component for Dashboard daily board"
```

---

### Task 5: Create `StatusStrip` component

**Files:**
- Create: `frontend/components/StatusStrip.tsx`
- Test: `frontend/components/__tests__/StatusStrip.test.tsx`

**Interfaces:**
- Produces: `StatusStrip(): JSX.Element | null` — no props; fetches `rankProgress` itself via `fetchRankProgress()` (same call `HunterCard` makes); reads `streakCount`/`rank` from `useAuth().userProfile`; reads next-quest from `useQuests()` context (must be rendered under a `QuestProvider`); computes `streakAtRisk` the same way `HunterCard` does.
- Consumes: `RankProgressBar` (Task 1, `variant="compact"`), `StreakPanel` (Task 2, `variant="compact"`), `NextObjectiveCard` (Task 3), `useQuests` (`@/context/QuestContext`), `useAuth` (`@/context/AuthContext`), `fetchRankProgress`/`RankProgress` (`@/lib/api`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/__tests__/StatusStrip.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatusStrip from '../StatusStrip';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { rank: 'D', streakCount: 3 },
  }),
}));

vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({
    quests: [{ id: '1', title: 'Run 5km', completed: false, currentValue: 1, targetValue: 5 }],
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchRankProgress: vi.fn().mockResolvedValue({
    metCount: 1, totalCount: 3, nextRank: 'C', criteria: [],
  }),
}));

describe('StatusStrip', () => {
  it('renders compact rank bar, streak, and next objective once data loads', async () => {
    render(<StatusStrip />);
    await waitFor(() => {
      expect(screen.getByText('1/3 conditions met for C-Rank')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Run 5km')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/StatusStrip.test.tsx`
Expected: FAIL — `Cannot find module '../StatusStrip'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/components/StatusStrip.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuests } from '@/context/QuestContext';
import { fetchRankProgress, RankProgress } from '@/lib/api';
import RankProgressBar from './RankProgressBar';
import StreakPanel from './StreakPanel';
import NextObjectiveCard from './NextObjectiveCard';

export default function StatusStrip() {
  const { userProfile } = useAuth();
  const { quests } = useQuests();
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    fetchRankProgress().then(setRankProgress).catch(() => {});
  }, [userProfile]);

  if (!userProfile) return null;

  const { rank, streakCount } = userProfile;
  const questsReady   = quests.length >= 0;
  const questsDone    = quests.filter((q) => q.completed).length;
  const questsTotal   = quests.length;
  const streakAtRisk  = streakCount > 0 && questsTotal > 0 && questsDone === 0;
  const nextQuest     = quests.find((q) => !q.completed) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-4 mb-6">
      <RankProgressBar rank={rank ?? 'E'} rankProgress={rankProgress} variant="compact" />
      <StreakPanel
        streakCount={streakCount}
        streakAtRisk={streakAtRisk}
        activePenalty={false}
        showPressure={false}
        hoursLeft={0}
        minutesLeft={0}
        questsRemaining={0}
        variant="compact"
      />
      {questsReady && nextQuest && <NextObjectiveCard quest={nextQuest} ready={questsReady} />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/__tests__/StatusStrip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/StatusStrip.tsx frontend/components/__tests__/StatusStrip.test.tsx
git commit -m "feat: add StatusStrip component for new Dashboard"
```

---

### Task 6: Rebuild `Dashboard.tsx` composition (alert layer + StatusStrip + daily board)

**Files:**
- Modify: `frontend/components/Dashboard.tsx` (full rewrite of the composition)

**Interfaces:**
- Consumes: `StatusStrip` (Task 5), `DailySnapshot` (Task 4) — both render under `QuestProvider`/`ChallengeProvider`, which Task 7 moves to wrap this component's mount point.
- No prop changes to `Dashboard` itself — still a no-prop component reading `useQuests()`/`useAuth()`.

- [ ] **Step 1: Rewrite `frontend/components/Dashboard.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import {
  fetchActivePenalty,
  fetchWeekendBoss,
  generateWeekendBoss,
  PenaltyQuest,
  WeekendBoss,
} from '@/lib/api';
import PenaltyAlert from './PenaltyAlert';
import WeekendBossCard from './WeekendBossCard';
import UrgencyBanner from './UrgencyBanner';
import ChallengeSection from './ChallengeSection';
import QuestSection from './QuestSection';
import DailySummaryPanel from './DailySummaryPanel';
import StatusStrip from './StatusStrip';
import DailySnapshot from './DailySnapshot';

export default function Dashboard() {
  const { quests } = useQuests();
  const { firebaseUser } = useAuth();

  const [penalty,     setPenalty]     = useState<PenaltyQuest | null>(null);
  const [weekendBoss, setWeekendBoss] = useState<WeekendBoss | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchActivePenalty().then((r) => setPenalty(r.penalty)).catch(() => {});

    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      generateWeekendBoss()
        .then((r) => setWeekendBoss(r.boss ?? null))
        .catch(() => fetchWeekendBoss().then((r) => setWeekendBoss(r.boss)).catch(() => {}));
    }
  }, [firebaseUser]);

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      {/* ── Alert layer — unconditional, above everything else ── */}
      {penalty && !penalty.completed && (
        <PenaltyAlert penalty={penalty} onUpdate={setPenalty} />
      )}
      {weekendBoss && (
        <WeekendBossCard boss={weekendBoss} onUpdate={setWeekendBoss} />
      )}
      <UrgencyBanner quests={quests} />

      {/* ── Status strip ── */}
      <StatusStrip />

      {/* ── Daily board ── */}
      <div className="mb-6">
        <p className="text-muted text-xs tracking-wide uppercase">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h2 className="text-2xl font-bold text-white mt-1">Daily Board</h2>
      </div>

      <DailySnapshot />
      <DailySummaryPanel />
      <ChallengeSection />

      <div className="border-t border-border/40 my-6" />

      <QuestSection />
    </main>
  );
}
```

- [ ] **Step 2: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Dashboard.tsx
git commit -m "feat: compose StatusStrip + DailySnapshot into Dashboard"
```

---

### Task 7: Move `/dashboard` → `/`, move old `/` content → `/profile`

**Files:**
- Modify: `frontend/app/page.tsx` (becomes the new Dashboard route)
- Create: `frontend/app/profile/page.tsx` (new Profile route, old `/` content)
- Modify: `frontend/app/dashboard/page.tsx` (becomes a client-side redirect to `/`)

- [ ] **Step 1: Create `frontend/app/profile/page.tsx`**

```tsx
'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import Header from '@/components/Header';
import HunterCard from '@/components/HunterCard';
import SystemFeed from '@/components/SystemFeed';
import LoadingScreen from '@/components/LoadingScreen';

export default function ProfilePage() {
  const { firebaseUser, loading } = useRequireAuth();

  if (loading) return <LoadingScreen />;

  if (!firebaseUser) return null;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-sm mx-auto px-6 py-10">
        <HunterCard />
        <SystemFeed />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `frontend/app/page.tsx`**

```tsx
'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { QuestProvider } from '@/context/QuestContext';
import { ChallengeProvider } from '@/context/ChallengeContext';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import LoadingScreen from '@/components/LoadingScreen';

export default function HomePage() {
  const { firebaseUser, loading } = useRequireAuth();

  if (loading) return <LoadingScreen />;

  if (!firebaseUser) return null;

  return (
    <QuestProvider>
      <ChallengeProvider>
        <div className="min-h-screen bg-bg">
          <Header />
          <Dashboard />
        </div>
      </ChallengeProvider>
    </QuestProvider>
  );
}
```

- [ ] **Step 3: Rewrite `frontend/app/dashboard/page.tsx` as a redirect**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return <LoadingScreen />;
}
```

- [ ] **Step 4: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds, `next build` lists `/`, `/profile`, `/dashboard` as valid routes

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (from `frontend/`), then in a browser:
- Visit `/` → should show alert layer (if any active) + StatusStrip + Daily board, not the old Profile card.
- Visit `/profile` → should show the identity card, full rank progress w/ criteria, stats radar, AI insight, system feed.
- Visit `/dashboard` → should immediately redirect to `/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/page.tsx frontend/app/profile/page.tsx frontend/app/dashboard/page.tsx
git commit -m "feat: move Dashboard to / and Profile to /profile, redirect old /dashboard"
```

---

### Task 8: Update `Header` nav order and active-state routing

**Files:**
- Modify: `frontend/components/Header.tsx:12-18`

- [ ] **Step 1: Update `NAV_TABS`**

Replace lines 12-18:

```tsx
const NAV_TABS = [
  { label: 'Dashboard', href: '/'          },
  { label: 'Profile',   href: '/profile'   },
  { label: 'History',   href: '/history'   },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Titles',    href: '/titles'    },
];
```

No change needed to the active-state check (`pathname === tab.href`, line 80) — it already works correctly since `/profile` is now an explicit route matching the new "Profile" tab's href, and `/` matches "Dashboard".

- [ ] **Step 2: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds

- [ ] **Step 3: Manual verification**

In the browser, confirm nav order reads "Dashboard · Profile · History · Analytics · Titles" and the active tab underline follows the current route on `/`, `/profile`, `/history`, `/analytics`, `/titles`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Header.tsx
git commit -m "feat: reorder nav tabs for Dashboard-first IA, add Profile tab"
```

---

### Task 9: Delete confirmed-dead legacy components

Resolves spec §6.2. The codebase survey confirmed zero import sites for these four components anywhere in `app/`, `components/`, `context/`, `hooks/`, `lib/`, `utils/`.

**Files:**
- Delete: `frontend/components/XPProgressBar.tsx`
- Delete: `frontend/components/StatItem.tsx`
- Delete: `frontend/components/RewardsPanel.tsx`
- Delete: `frontend/components/XPToast.tsx`

- [ ] **Step 1: Confirm still-dead before deleting**

Run: `grep -rln "XPProgressBar\|StatItem\|RewardsPanel\|XPToast" frontend/app frontend/components frontend/context frontend/hooks frontend/lib frontend/utils --include="*.tsx" --include="*.ts" | grep -v "components/XPProgressBar.tsx\|components/StatItem.tsx\|components/RewardsPanel.tsx\|components/XPToast.tsx"`
Expected: no output (no external references)

- [ ] **Step 2: Delete the four files**

```bash
git rm frontend/components/XPProgressBar.tsx frontend/components/StatItem.tsx frontend/components/RewardsPanel.tsx frontend/components/XPToast.tsx
```

- [ ] **Step 3: Run full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds (confirms nothing was silently relying on these files)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove confirmed-dead legacy components (XPProgressBar, StatItem, RewardsPanel, XPToast)"
```

---

## Flagged but out of scope for this plan

- **`LevelUpModal`** is currently unwired to any page (zero import sites). Neither spec assigns wiring it up as a task, but both specs reference it as a self-review screenshot target. Wiring it into the level-up flow (likely inside `HunterCard` or a global toast layer, triggered by comparing previous/current `level` from `userProfile`) is real feature work with its own design questions (where does "previous level" come from — needs a ref/comparison, not just current state) and should be scoped as its own follow-up task, not bundled into either the IA or theming pass.
- Any visual/theming changes (tokens, fonts, icons, background texture, login page redesign) — see `2026-07-19-ui-revamp.md`.
