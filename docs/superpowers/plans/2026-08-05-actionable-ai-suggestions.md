# Actionable AI Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Coach Suggests" AI cards on the dashboard tappable — accept a suggestion, then tap again to complete it and claim its XP.

**Architecture:** Add a `status` field (`'suggested' | 'accepted' | 'completed'`) to the AI suggestion entries already cached once-per-day in Firestore's `aiCache/{userId}` doc. Two new backend endpoints transition that status (accept, complete-with-XP-award-in-a-transaction). The frontend suggestion card becomes a 3-state tappable button, mirroring the existing `ChallengeItem` component in the same file.

**Tech Stack:** Node/Express backend with Firestore (`backend/`), Next.js/React frontend (`frontend/`), Jest (backend tests), Vitest + Testing Library (frontend tests).

## Global Constraints

- This is a single-user personal app — `authenticate` middleware already restricts all API access to one Firebase account. No new auth logic needed.
- XP awards must go through `computeXpGain` (pure function in `backend/services/xpService.js`) inside a Firestore transaction, exactly like `backend/services/challengeService.js:completeChallenge` — never write `xp`/`level` directly.
- Known/expected errors must be thrown as `AppError(message, status)` (`backend/utils/AppError.js`) so `asyncHandler` (`backend/middleware/asyncHandler.js`) turns them into the right HTTP status instead of a generic 500.
- Backend tests use the in-memory Firestore stand-in at `backend/test-helpers/fakeFirestore.js` and the `jest.mock('../config/firebase', ...)` + `jest.resetModules()` pattern already used in `backend/__tests__/penaltyService.test.js` and `backend/__tests__/concurrentGeneration.test.js` — follow that pattern exactly, don't invent a new mocking approach.
- Frontend tests use Vitest + `@testing-library/react` (see `frontend/components/__tests__/StatusStrip.test.tsx` for the mocking pattern: `vi.mock('@/context/...')`, `vi.mock('@/lib/api')`).
- No new Firestore collections. No changes to `dailyChallenges`, `dailyQuests`, or any other existing collection.
- No numeric progress bars for suggestions — status is binary-transition only (`suggested → accepted → completed`).
- No "reject/dismiss" action — out of scope for this plan.

---

### Task 1: Backend — tag generated AI suggestions with an initial status

**Files:**
- Modify: `backend/services/ai.service.js:191-212` (the `generateChallenges` function)
- Modify: `backend/routes/aiRoutes.js:38-45` (the `/challenges` route's inline error-fallback)
- Test: `backend/__tests__/aiSuggestionStatus.test.js` (new)

**Interfaces:**
- Produces: every element returned by `generateChallenges(userId)` now has a `status: 'suggested'` field alongside the existing `title`, `description`, `xpReward`. Task 2 relies on this field existing on every cached suggestion.

- [ ] **Step 1: Write the failing test**

Create `backend/__tests__/aiSuggestionStatus.test.js`:

```js
const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  jest.resetModules();
  // Force the no-API-key fallback path so results are deterministic —
  // we're not testing the LLM integration here, just the status tagging.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

describe('generateChallenges', () => {
  test('tags each generated suggestion with status "suggested"', async () => {
    const { generateChallenges } = require('../services/ai.service');
    const userId = 'user-1';

    await mockFakeDb.collection('users').doc(userId).set({ rank: 'E', level: 1, streakCount: 0 });

    const challenges = await generateChallenges(userId);

    expect(challenges.length).toBeGreaterThan(0);
    for (const c of challenges) {
      expect(c.status).toBe('suggested');
    }
  });

  test('caches the tagged suggestions so a second call returns the same status', async () => {
    const { generateChallenges } = require('../services/ai.service');
    const userId = 'user-2';

    await mockFakeDb.collection('users').doc(userId).set({ rank: 'E', level: 1, streakCount: 0 });

    const first = await generateChallenges(userId);
    const second = await generateChallenges(userId);

    expect(second).toEqual(first);
    expect(second[0].status).toBe('suggested');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest aiSuggestionStatus -v`
Expected: FAIL — `expect(c.status).toBe('suggested')` fails because `status` is `undefined` (the field doesn't exist yet).

- [ ] **Step 3: Implement — tag suggestions in `generateChallenges`**

In `backend/services/ai.service.js`, replace the `generateChallenges` function (currently lines 191-212):

```js
async function generateChallenges(userId) {
  const cached = await getCachedAI(userId);
  if (cached?.challenges) return cached.challenges;

  const ctx = await getUserContext(userId);
  const prompt = buildChallengesPrompt(ctx);
  const raw = await callAI(prompt, JSON.stringify(DEFAULT_CHALLENGES));

  let challenges;
  try {
    challenges = parseChallengesJSON(raw);
    if (!challenges || challenges.length === 0) throw new Error('Empty parse');
  } catch {
    logger.error('[AI] Challenge parse failed, using default');
    challenges = DEFAULT_CHALLENGES;
  }

  challenges = challenges.map((c) => ({ ...c, status: 'suggested' }));

  const current = await getCachedAI(userId);
  await setCachedAI(userId, current?.insight || null, challenges);

  return challenges;
}
```

The only change is the new `challenges = challenges.map((c) => ({ ...c, status: 'suggested' }));` line, which runs identically whether `challenges` came from the parsed LLM response or the `DEFAULT_CHALLENGES` fallback.

Also update the route's own separate safety-net fallback (used only if `generateChallenges` itself throws unexpectedly) in `backend/routes/aiRoutes.js`, so its shape stays consistent with the real path. Replace lines 38-45:

```js
    res.json({
      challenges: [
        {
          title: 'Complete every daily challenge',
          description: "Don't skip a single one today.",
          xpReward: 25,
          status: 'suggested',
        },
      ],
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest aiSuggestionStatus -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/services/ai.service.js backend/routes/aiRoutes.js backend/__tests__/aiSuggestionStatus.test.js
git commit -m "feat: tag AI-generated suggestions with an initial status"
```

---

### Task 2: Backend — accept/complete service logic and routes

**Files:**
- Modify: `backend/services/ai.service.js` (imports, new functions, exports)
- Modify: `backend/routes/aiRoutes.js` (imports, two new routes)
- Test: `backend/__tests__/aiChallengeActions.test.js` (new)

**Interfaces:**
- Consumes: `computeXpGain(user, amount)` from `backend/services/xpService.js` (returns `{ updates, result }`, exact shape already used in `backend/services/challengeService.js:109-112`); `evaluateTitles(userId)` from `backend/services/titleService.js`; `updateUserRank(userId)` from `backend/services/rankService.js`; `AppError` from `backend/utils/AppError.js`; the `status: 'suggested'` field produced by Task 1.
- Produces: `acceptChallenge(userId, index)` → `Promise<{ status: 'accepted' }>` (or throws `AppError` 404). `completeAISuggestion(userId, index)` → `Promise<{ completed: true, xp: XPResult } | { alreadyCompleted: true }>` (or throws `AppError` 404/409). Two routes: `PATCH /api/ai/challenges/:index/accept` and `PATCH /api/ai/challenges/:index/complete`. Task 3 (frontend) calls these two routes by exact path.

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/aiChallengeActions.test.js`:

```js
const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

// Isolate the unit under test from the real title/rank evaluation logic —
// completeAISuggestion fires these as non-blocking side effects after the
// XP transaction commits; we only assert on the transaction's own result.
jest.mock('../services/titleService', () => ({ evaluateTitles: jest.fn().mockResolvedValue() }));
jest.mock('../services/rankService', () => ({ updateUserRank: jest.fn().mockResolvedValue() }));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  jest.resetModules();
});

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

describe('acceptChallenge', () => {
  test('moves a suggestion from suggested to accepted', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-1';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    const result = await acceptChallenge(userId, 0);
    expect(result.status).toBe('accepted');

    const snap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(snap.data().challenges[0].status).toBe('accepted');
  });

  test('accepting an already-accepted suggestion is a no-op', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-2';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted' }],
    });

    const result = await acceptChallenge(userId, 0);
    expect(result.status).toBe('accepted');
  });

  test('throws 404 when the suggestion index does not exist', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-3';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    await expect(acceptChallenge(userId, 5)).rejects.toMatchObject({ status: 404 });
  });

  test('throws 404 when the cached suggestions are from a previous day', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-8';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: '2020-01-01',
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    await expect(acceptChallenge(userId, 0)).rejects.toMatchObject({ status: 404 });
  });
});

describe('completeAISuggestion', () => {
  test('awards XP and marks the suggestion completed when accepted', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-4';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted' }],
    });

    const result = await completeAISuggestion(userId, 0);
    expect(result.completed).toBe(true);
    expect(result.xp.xpGained).toBe(20);

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    expect(userSnap.data().xp).toBe(20);

    const aiSnap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(aiSnap.data().challenges[0].status).toBe('completed');
  });

  test('throws 409 when completing a suggestion that was never accepted', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-5';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    await expect(completeAISuggestion(userId, 0)).rejects.toMatchObject({ status: 409 });
  });

  test('completing an already-completed suggestion is idempotent and does not double-award XP', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-6';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 20 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'completed' }],
    });

    const result = await completeAISuggestion(userId, 0);
    expect(result.alreadyCompleted).toBe(true);

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    expect(userSnap.data().xp).toBe(20); // unchanged
  });

  test('throws 404 for an out-of-range index', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-7';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    await expect(completeAISuggestion(userId, 3)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest aiChallengeActions -v`
Expected: FAIL — `acceptChallenge` and `completeAISuggestion` are not exported yet (`TypeError: acceptChallenge is not a function` or similar).

- [ ] **Step 3: Implement the service functions**

In `backend/services/ai.service.js`, update the top-of-file imports (currently lines 1-4) to:

```js
const { db } = require('../config/firebase');
const { getMemory } = require('./aiMemory.service');
const { VOICE_INSTRUCTION, FALLBACKS, buildMemoryBlock } = require('./systemVoice');
const { computeXpGain } = require('./xpService');
const { evaluateTitles } = require('./titleService');
const { updateUserRank } = require('./rankService');
const { AppError } = require('../utils/AppError');
const { logger } = require('../utils/logger');
```

Then add these two functions right after `generateChallenges` (which Task 1 left ending with `return challenges; }` followed by the closing brace and a blank line, just before `module.exports`):

```js
/**
 * Moves a cached suggestion from 'suggested' to 'accepted'.
 * Idempotent: accepting an already-accepted or completed suggestion just
 * returns its current status without modifying anything.
 */
async function acceptChallenge(userId, index) {
  const cached = await getCachedAI(userId);
  if (!cached?.challenges?.[index]) {
    throw new AppError('Suggestion not found', 404);
  }

  const challenge = cached.challenges[index];
  if (challenge.status !== 'suggested') {
    return { status: challenge.status };
  }

  const challenges = cached.challenges.map((c, i) =>
    i === index ? { ...c, status: 'accepted' } : c
  );
  await setCachedAI(userId, cached.insight, challenges);

  return { status: 'accepted' };
}

/**
 * Completes an accepted suggestion: awards its XP to the user and marks it
 * 'completed', both inside one Firestore transaction (same shape as
 * challengeService.completeChallenge). Fires title/rank re-evaluation
 * afterward since the XP gain can cross a rank or title threshold.
 */
async function completeAISuggestion(userId, index) {
  const aiRef = db.collection('aiCache').doc(userId);
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const [aiSnap, userSnap] = await Promise.all([tx.get(aiRef), tx.get(userRef)]);

    if (!aiSnap.exists) throw new AppError('Suggestions not found', 404);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const data = aiSnap.data();
    if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

    const challenge = data.challenges?.[index];
    if (!challenge) throw new AppError('Suggestion not found', 404);

    if (challenge.status === 'completed') return { alreadyCompleted: true };
    if (challenge.status !== 'accepted') {
      throw new AppError('Suggestion must be accepted before it can be completed', 409);
    }

    const updatedChallenges = data.challenges.map((c, i) =>
      i === index ? { ...c, status: 'completed' } : c
    );

    const { updates, result: xpResult } = computeXpGain(userSnap.data(), challenge.xpReward);

    tx.update(aiRef, { challenges: updatedChallenges });
    tx.update(userRef, updates);

    return { completed: true, xp: xpResult };
  });

  if (result.completed) {
    evaluateTitles(userId).catch((e) => logger.error({ err: e, userId }, 'Title evaluation failed'));
    updateUserRank(userId).catch((e) => logger.error({ err: e, userId }, 'Rank update failed'));
  }

  return result;
}
```

Finally, update `module.exports` (currently `module.exports = { generateInsight, generateChallenges };`) to:

```js
module.exports = { generateInsight, generateChallenges, acceptChallenge, completeAISuggestion };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest aiChallengeActions -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Wire up the routes**

In `backend/routes/aiRoutes.js`, update the top import (currently `const { generateInsight, generateChallenges } = require('../services/ai.service');`) to:

```js
const { generateInsight, generateChallenges, acceptChallenge, completeAISuggestion } = require('../services/ai.service');
```

Then add these two routes immediately after the existing `POST /api/ai/challenges` route (right before the `// GET /api/ai/memory` comment):

```js
// PATCH /api/ai/challenges/:index/accept
router.patch('/challenges/:index/accept', asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'index must be a non-negative integer' });
  }
  const result = await acceptChallenge(req.userId, index);
  res.json(result);
}));

// PATCH /api/ai/challenges/:index/complete
router.patch('/challenges/:index/complete', asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'index must be a non-negative integer' });
  }
  const result = await completeAISuggestion(req.userId, index);
  res.json(result);
}));
```

- [ ] **Step 6: Sanity-check the routes file loads cleanly**

Run: `cd backend && node -e "require('./routes/aiRoutes.js'); console.log('OK')"`
Expected: prints `OK` with no errors (catches typos/syntax issues before running the full server).

- [ ] **Step 7: Run the full backend test suite**

Run: `cd backend && npx jest`
Expected: all tests pass, including the new `aiSuggestionStatus` and `aiChallengeActions` suites.

- [ ] **Step 8: Commit**

```bash
git add backend/services/ai.service.js backend/routes/aiRoutes.js backend/__tests__/aiChallengeActions.test.js
git commit -m "feat: add accept/complete endpoints for AI coach suggestions"
```

---

### Task 3: Frontend — API client functions

**Files:**
- Modify: `frontend/lib/api.ts` (the `AISuggestion` interface, plus two new exported functions)

**Interfaces:**
- Consumes: `apiFetch<T>(path, options)` (existing helper, `frontend/lib/api.ts:15-22`); the `XPResult` interface (existing, `frontend/lib/api.ts:474-480`); the two routes from Task 2 (`PATCH /api/ai/challenges/:index/accept`, `PATCH /api/ai/challenges/:index/complete`).
- Produces: `AISuggestion.status: 'suggested' | 'accepted' | 'completed'`; `acceptAISuggestion(index: number): Promise<{ status: string }>`; `completeAISuggestion(index: number): Promise<{ completed?: boolean; alreadyCompleted?: boolean; xp?: XPResult }>`. Task 4 imports and calls both functions and reads `.status` off `AISuggestion`.

- [ ] **Step 1: Update the `AISuggestion` interface**

In `frontend/lib/api.ts`, replace (currently lines 482-486):

```ts
export interface AISuggestion {
  title: string;
  description: string;
  xpReward: number;
}
```

with:

```ts
export interface AISuggestion {
  title: string;
  description: string;
  xpReward: number;
  status: 'suggested' | 'accepted' | 'completed';
}
```

- [ ] **Step 2: Add the two client functions**

Immediately after the existing `fetchAIChallenges` function (currently `frontend/lib/api.ts:158-160`):

```ts
export function fetchAIChallenges() {
  return apiFetch<{ challenges: AISuggestion[] }>('/api/ai/challenges', { method: 'POST' });
}

export function acceptAISuggestion(index: number) {
  return apiFetch<{ status: string }>(`/api/ai/challenges/${index}/accept`, { method: 'PATCH' });
}

export function completeAISuggestion(index: number) {
  return apiFetch<{ completed?: boolean; alreadyCompleted?: boolean; xp?: XPResult }>(
    `/api/ai/challenges/${index}/complete`,
    { method: 'PATCH' }
  );
}
```

(`XPResult` is already defined further down the same file at lines 474-480 — TypeScript doesn't require it to be declared before use at module scope, so no reordering is needed.)

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add frontend API client for accepting/completing AI suggestions"
```

---

### Task 4: Frontend — three-state suggestion card

**Files:**
- Modify: `frontend/components/ChallengeSection.tsx`
- Test: `frontend/components/__tests__/ChallengeSection.test.tsx` (new)

**Interfaces:**
- Consumes: `AISuggestion` (with `.status`), `acceptAISuggestion(index)`, `completeAISuggestion(index)` from `@/lib/api` (Task 3); `useAuth()` → `{ refreshProfile: () => Promise<void> }` (existing, `frontend/context/AuthContext.tsx`); `useChallenges()` → `{ challengeDoc, loading }` (existing, `frontend/context/ChallengeContext.tsx`).
- Produces: a fully interactive "Coach Suggests" section — no other file depends on new exports from this one (it's a page-level component).

- [ ] **Step 1: Write the failing test**

Create `frontend/components/__tests__/ChallengeSection.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeSection from '../ChallengeSection';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
const acceptAISuggestion = vi.fn().mockResolvedValue({ status: 'accepted' });
const completeAISuggestion = vi.fn().mockResolvedValue({ completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

vi.mock('@/context/ChallengeContext', () => ({
  useChallenges: () => ({
    challengeDoc: { id: 'doc-1', challenges: [], bonusAwarded: false },
    loading: false,
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'u1' },
    refreshProfile,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchAIChallenges: vi.fn().mockResolvedValue({
    challenges: [
      { title: 'Daily Focus Protocol', description: 'Maintain focus sessions.', xpReward: 25, status: 'suggested' },
    ],
  }),
  acceptAISuggestion: (...args: unknown[]) => acceptAISuggestion(...args),
  completeAISuggestion: (...args: unknown[]) => completeAISuggestion(...args),
}));

describe('ChallengeSection — AI suggestion card', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    acceptAISuggestion.mockClear();
    completeAISuggestion.mockClear();
  });

  it('accepts, then completes, a suggestion via two taps', async () => {
    render(<ChallengeSection />);

    const card = await screen.findByRole('button', { name: /Daily Focus Protocol/i });

    fireEvent.click(card);
    await waitFor(() => expect(acceptAISuggestion).toHaveBeenCalledWith(0));
    await screen.findByText(/tap to complete/i);

    fireEvent.click(card);
    await waitFor(() => expect(completeAISuggestion).toHaveBeenCalledWith(0));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    await waitFor(() => expect(card).toBeDisabled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/__tests__/ChallengeSection.test.tsx`
Expected: FAIL — the suggestion currently renders as a plain `<div>`, not a `<button>` with an accessible name matching "Daily Focus Protocol", so `findByRole('button', ...)` times out.

- [ ] **Step 3: Implement — replace the suggestion `<div>` with a stateful `SuggestionCard`**

In `frontend/components/ChallengeSection.tsx`, update the import line (currently `import { DailyChallenge, AISuggestion, fetchAIChallenges } from '@/lib/api';`) to:

```tsx
import { DailyChallenge, AISuggestion, fetchAIChallenges, acceptAISuggestion, completeAISuggestion } from '@/lib/api';
```

Change the `aiSuggestions` state to also allow local status updates — the `useState` declaration itself doesn't change (`const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);`), but add these two updater helpers right after the existing `useEffect` that fetches suggestions (currently `ChallengeSection.tsx:28-33`):

```tsx
  function markAccepted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'accepted' } : s))
    );
  }

  function markCompleted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'completed' } : s))
    );
  }
```

Replace the suggestion-rendering block inside the `AnimatePresence` (currently `ChallengeSection.tsx:126-144`):

```tsx
            <div className="space-y-2">
              {aiSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border border-accent/20 bg-accent/5"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={14} className="text-accent-light/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-[11px] text-muted mt-0.5 leading-snug">{s.description}</p>
                  </div>
                  <span className="text-xs font-medium text-accent-light/70 shrink-0">
                    +{s.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
```

with:

```tsx
            <div className="space-y-2">
              {aiSuggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  index={i}
                  onAccepted={markAccepted}
                  onCompleted={markCompleted}
                />
              ))}
            </div>
```

Then add the `SuggestionCard` component at the bottom of the file, after the existing `ChallengeItem` function:

```tsx
// ─── AI suggestion card ─────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  onAccepted,
  onCompleted,
}: {
  suggestion: AISuggestion;
  index: number;
  onAccepted: (index: number) => void;
  onCompleted: (index: number) => void;
}) {
  const { refreshProfile } = useAuth();
  const isAccepted = suggestion.status === 'accepted';
  const isCompleted = suggestion.status === 'completed';

  async function handleClick() {
    if (suggestion.status === 'suggested') {
      await acceptAISuggestion(index);
      onAccepted(index);
    } else if (isAccepted) {
      await completeAISuggestion(index);
      onCompleted(index);
      await refreshProfile();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isCompleted}
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        isCompleted
          ? 'border-border/30 bg-surface/30 cursor-default'
          : isAccepted
          ? 'border-accent/40 bg-accent/10 hover:bg-accent/15 cursor-pointer'
          : 'border-accent/20 bg-accent/5 hover:bg-accent/10 cursor-pointer'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isCompleted
            ? 'border-accent bg-accent'
            : isAccepted
            ? 'border-accent-light bg-accent/30'
            : 'border-accent/40'
        }`}
      >
        {isCompleted ? (
          <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <Sparkles size={14} className={isAccepted ? 'text-accent-light' : 'text-accent-light/60'} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isCompleted ? 'text-muted line-through' : 'text-white'}`}>
          {suggestion.title}
        </p>
        <p className="text-[11px] text-muted mt-0.5 leading-snug">{suggestion.description}</p>
        {isAccepted && (
          <p className="text-[10px] text-accent-light/70 mt-1 uppercase tracking-wide">Tap to complete</p>
        )}
      </div>
      <span className={`text-xs font-medium shrink-0 ${isCompleted ? 'text-muted' : 'text-accent-light/70'}`}>
        +{suggestion.xpReward} XP
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/__tests__/ChallengeSection.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Type-check and run the full frontend test suite**

Run: `cd frontend && npx tsc --noEmit -p . && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Manually verify in the browser**

Run: `cd frontend && npm run dev`, open the dashboard, and confirm:
- A suggestion card looks the same as before on first load.
- Tapping it once shows the "Tap to complete" hint and a filled icon/border.
- Tapping it again dims/line-throughs the title, disables the card, and the header XP/level updates.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/ChallengeSection.tsx frontend/components/__tests__/ChallengeSection.test.tsx
git commit -m "feat: make AI coach suggestions tappable (accept then complete)"
```
