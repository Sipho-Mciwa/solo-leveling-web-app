# Coach Suggests Single-Select + Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Picking one "Coach Suggests" card locks out the other for the day, and accepting a suggestion generates an AI checklist of 3-5 concrete steps that must all be checked off to complete the suggestion and award its XP.

**Architecture:** Backend: a single-select invariant added to the existing `acceptChallenge` transaction, plus two new functions (`generateSubtasks`, `toggleSubtask`) and two new routes, all following the exact patterns already established in `ai.service.js`/`aiRoutes.js` for the existing accept/complete flow. Frontend: `ChallengeSection.tsx`'s `SuggestionCard` is restructured so accepting triggers a chained subtask-generation call, and the checklist rows (not the whole card) become the interactive surface once subtasks exist.

**Tech Stack:** Node/Express/Firestore (backend), Next.js/React/TypeScript/Vitest (frontend), Jest (backend tests).

## Global Constraints

- No new "select" concept — reuse the existing `status: 'suggested' | 'accepted' | 'completed'` field and the existing accept/complete transactions where possible.
- Once a suggestion is accepted, the other is locked out for the rest of the day — no switching (confirmed design decision).
- Subtasks have no `id` — array index (`subIndex`) is their stable identity, matching how suggestions themselves are identified by index (see `docs/superpowers/specs/2026-08-05-actionable-ai-suggestions-design.md`).
- Checking off every subtask auto-completes the suggestion and awards XP in the same transaction as the toggle — no separate manual "Complete" step in the normal flow.
- The existing `PATCH /api/ai/challenges/:index/complete` route and `completeAISuggestion` function stay in place unmodified, as a fallback for the rare case subtask generation produces zero subtasks.
- All new backend functions/routes follow the exact `AppError` status-code and Firestore-transaction patterns already used in `acceptChallenge`/`completeAISuggestion` (`backend/services/ai.service.js:225-298`).

---

### Task 1: Backend — single-select invariant, subtask generation, toggle + auto-complete

**Files:**
- Modify: `backend/services/ai.service.js`
- Modify: `backend/routes/aiRoutes.js`
- Test: `backend/__tests__/aiChallengeActions.test.js`

**Interfaces:**
- Consumes: existing `callAI(prompt, fallback)` (`ai.service.js:112-129`), `computeXpGain` (from `./xpService`), `AppError` (from `../utils/AppError`), `VOICE_INSTRUCTION` (from `./systemVoice`).
- Produces:
  - `generateSubtasks(userId: string, index: number): Promise<{title: string; completed: boolean}[]>` — exported from `ai.service.js`.
  - `toggleSubtask(userId: string, index: number, subIndex: number): Promise<{subtasks: {title:string;completed:boolean}[]; completed: boolean; xp?: {xp:number;level:number;xpGained:number;leveledUp:boolean;previousLevel:number}}>` — exported from `ai.service.js`.
  - `POST /api/ai/challenges/:index/subtasks` → `{ subtasks: [...] }`
  - `PATCH /api/ai/challenges/:index/subtasks/:subIndex/toggle` → `{ subtasks: [...], completed: boolean, xp?: {...} }`

- [ ] **Step 1: Write the failing tests**

First, update the file's existing top-level `beforeEach` (currently lines 15-18):

```js
beforeEach(() => {
  mockFakeDb = createFakeDb();
  jest.resetModules();
  // Force the deterministic no-API-key fallback path for any test that
  // exercises callAI (generateSubtasks) — matches the convention already
  // used in __tests__/aiSuggestionStatus.test.js. We're not testing LLM
  // integration, just that generateSubtasks correctly parses whatever
  // string callAI returns and persists it.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});
```

Then append to `backend/__tests__/aiChallengeActions.test.js` (after the existing `completeAISuggestion` describe block, before the final closing — the file currently ends at line 182 with the last `});` closing `describe('completeAISuggestion', ...)`; add these as new top-level `describe` blocks after it):

```js
describe('acceptChallenge — single-select invariant', () => {
  test('accepting a second suggestion while another is already accepted throws 409', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-11';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [
        { title: 'First', description: 'Do it', xpReward: 20, status: 'accepted' },
        { title: 'Second', description: 'Do it too', xpReward: 20, status: 'suggested' },
      ],
    });

    await expect(acceptChallenge(userId, 1)).rejects.toMatchObject({ status: 409 });

    const snap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(snap.data().challenges[1].status).toBe('suggested');
  });

  test('accepting a second suggestion while another is already completed throws 409', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-12';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [
        { title: 'First', description: 'Do it', xpReward: 20, status: 'completed' },
        { title: 'Second', description: 'Do it too', xpReward: 20, status: 'suggested' },
      ],
    });

    await expect(acceptChallenge(userId, 1)).rejects.toMatchObject({ status: 409 });
  });

  test('accepting the only suggested one when the other is still suggested succeeds', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-13';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [
        { title: 'First', description: 'Do it', xpReward: 20, status: 'suggested' },
        { title: 'Second', description: 'Do it too', xpReward: 20, status: 'suggested' },
      ],
    });

    const result = await acceptChallenge(userId, 1);
    expect(result.status).toBe('accepted');
  });
});

describe('generateSubtasks', () => {
  test('generates DEFAULT_SUBTASKS via the deterministic no-API-key fallback path and persists them', async () => {
    // No GEMINI_API_KEY/GROQ_API_KEY (deleted in beforeEach) means callAI
    // returns its `fallback` argument verbatim — JSON.stringify(DEFAULT_SUBTASKS)
    // — which parseSubtasksJSON then parses back into subtask objects. This
    // exercises the real parse path without needing to mock the Gemini/Groq
    // SDKs (no precedent for that in this test suite — see aiSuggestionStatus.test.js).
    const { generateSubtasks } = require('../services/ai.service');
    const userId = 'user-14';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted' }],
    });

    const subtasks = await generateSubtasks(userId, 0);
    expect(subtasks).toEqual([
      { title: 'Initiate the protocol immediately.', completed: false },
      { title: 'Execute without interruption.', completed: false },
      { title: 'Log completion status.', completed: false },
    ]);

    const snap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(snap.data().challenges[0].subtasks).toEqual(subtasks);
  });

  test('throws 409 when generating subtasks for a suggestion that is not accepted', async () => {
    const { generateSubtasks } = require('../services/ai.service');
    const userId = 'user-16';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'suggested' }],
    });

    await expect(generateSubtasks(userId, 0)).rejects.toMatchObject({ status: 409 });
  });

  test('is idempotent — calling twice returns the already-generated subtasks without regenerating', async () => {
    const { generateSubtasks } = require('../services/ai.service');
    const userId = 'user-17';
    const existingSubtasks = [{ title: 'Already here', completed: false }];

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted', subtasks: existingSubtasks }],
    });

    const subtasks = await generateSubtasks(userId, 0);
    expect(subtasks).toEqual(existingSubtasks);
  });
});

describe('toggleSubtask', () => {
  test('toggling one of several incomplete subtasks does not complete the suggestion or award XP', async () => {
    const { toggleSubtask } = require('../services/ai.service');
    const userId = 'user-18';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{
        title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted',
        subtasks: [{ title: 'A', completed: false }, { title: 'B', completed: false }],
      }],
    });

    const result = await toggleSubtask(userId, 0, 0);
    expect(result.completed).toBe(false);
    expect(result.subtasks[0].completed).toBe(true);
    expect(result.subtasks[1].completed).toBe(false);

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    expect(userSnap.data().xp).toBe(0);
  });

  test('toggling the last remaining unchecked subtask completes the suggestion and awards XP', async () => {
    const { toggleSubtask } = require('../services/ai.service');
    const userId = 'user-19';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{
        title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted',
        subtasks: [{ title: 'A', completed: true }, { title: 'B', completed: false }],
      }],
    });

    const result = await toggleSubtask(userId, 0, 1);
    expect(result.completed).toBe(true);
    expect(result.xp.xpGained).toBe(20);

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    expect(userSnap.data().xp).toBe(20);

    const aiSnap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(aiSnap.data().challenges[0].status).toBe('completed');
  });

  test('throws 409 when toggling a subtask on an already-completed suggestion', async () => {
    const { toggleSubtask } = require('../services/ai.service');
    const userId = 'user-20';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 20 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{
        title: 'Test', description: 'Do it', xpReward: 20, status: 'completed',
        subtasks: [{ title: 'A', completed: true }],
      }],
    });

    await expect(toggleSubtask(userId, 0, 0)).rejects.toMatchObject({ status: 409 });
  });

  test('throws 404 for an out-of-range subIndex', async () => {
    const { toggleSubtask } = require('../services/ai.service');
    const userId = 'user-21';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{
        title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted',
        subtasks: [{ title: 'A', completed: false }],
      }],
    });

    await expect(toggleSubtask(userId, 0, 5)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest __tests__/aiChallengeActions.test.js`
Expected: FAIL — the single-select tests fail because `acceptChallenge` has no invariant check yet; the `generateSubtasks`/`toggleSubtask` tests fail with "is not a function" since neither is exported yet.

- [ ] **Step 3: Add the single-select invariant to `acceptChallenge`**

In `backend/services/ai.service.js`, inside `acceptChallenge` (currently lines 225-250), insert the invariant check between the existing `if (status !== 'suggested') { return { status }; }` block and the `updatedChallenges` map:

```js
    const alreadySelected = data.challenges.some(
      (c, i) => i !== index && (c.status ?? 'suggested') !== 'suggested'
    );
    if (alreadySelected) {
      throw new AppError('Another suggestion has already been selected today', 409);
    }
```

- [ ] **Step 4: Add `DEFAULT_SUBTASKS`, `buildSubtasksPrompt`, `parseSubtasksJSON`, `generateSubtasks`, and `toggleSubtask`**

In `backend/services/ai.service.js`, add near the other defaults (after `DEFAULT_CHALLENGES`, currently ending at line 19):

```js
const DEFAULT_SUBTASKS = [
  'Initiate the protocol immediately.',
  'Execute without interruption.',
  'Log completion status.',
];
```

Add near the other prompt builders (after `buildChallengesPrompt`, currently ending at line 162):

```js
function buildSubtasksPrompt(challenge) {
  return `${VOICE_INSTRUCTION}

Protocol: ${challenge.title}
Directive: ${challenge.description}

Break this protocol into 3 to 5 concrete, sequential action steps as a JSON array of strings. Return ONLY the JSON array, no explanation, no markdown:
["step one", "step two", "step three"]

Constraints:
- Each step: one short imperative sentence, approved vocabulary, no punctuation beyond a period
- Steps must be concrete actions the hunter physically does, not restatements of the goal`;
}
```

Add near the other parse helper (after `parseChallengesJSON`, currently ending at line 176):

```js
function parseSubtasksJSON(text) {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  return parsed.slice(0, 5).map((title) => ({ title: String(title).trim(), completed: false }));
}
```

Add `generateSubtasks` and `toggleSubtask` after `completeAISuggestion` (currently ending at line 298, before `module.exports`):

```js
/**
 * Generates and persists a 3-5 item action checklist for an accepted
 * suggestion. Idempotent: if subtasks already exist for this index, returns
 * them without calling the AI again. The AI call runs outside any
 * transaction (external I/O shouldn't run inside a retryable transaction
 * body); a narrow follow-up transaction re-checks the suggestion is still
 * 'accepted' before writing, so a suggestion that changed state while the
 * AI call was in flight doesn't get corrupted.
 */
async function generateSubtasks(userId, index) {
  const aiRef = db.collection('aiCache').doc(userId);
  const snap = await aiRef.get();
  if (!snap.exists) throw new AppError('Suggestions not found', 404);

  const data = snap.data();
  if (data.date !== todayStr()) throw new AppError('Suggestions not found', 404);

  const challenge = data.challenges?.[index];
  if (!challenge) throw new AppError('Suggestion not found', 404);
  if (challenge.status !== 'accepted') {
    throw new AppError('Suggestion must be accepted before generating a checklist', 409);
  }
  if (challenge.subtasks) return challenge.subtasks;

  const prompt = buildSubtasksPrompt(challenge);
  const raw = await callAI(prompt, JSON.stringify(DEFAULT_SUBTASKS));

  let subtasks;
  try {
    subtasks = parseSubtasksJSON(raw);
    if (!subtasks) throw new Error('Empty parse');
  } catch {
    logger.error('[AI] Subtask parse failed, using default');
    subtasks = DEFAULT_SUBTASKS.map((title) => ({ title, completed: false }));
  }

  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(aiRef);
    const freshData = freshSnap.data();
    if (freshData.date !== todayStr() || freshData.challenges?.[index]?.status !== 'accepted') return;
    const updated = freshData.challenges.map((c, i) => (i === index ? { ...c, subtasks } : c));
    tx.update(aiRef, { challenges: updated });
  });

  return subtasks;
}

/**
 * Toggles one subtask's completed flag. If this toggle results in every
 * subtask being complete, auto-completes the suggestion and awards its XP
 * in the same transaction (mirrors completeAISuggestion's transaction
 * shape) — no separate manual "complete" step in the normal flow.
 */
async function toggleSubtask(userId, index, subIndex) {
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
    if (challenge.status === 'completed') {
      throw new AppError('Suggestion already completed', 409);
    }
    if (challenge.status !== 'accepted' || !challenge.subtasks?.[subIndex]) {
      throw new AppError('Subtask not found', 404);
    }

    const updatedSubtasks = challenge.subtasks.map((s, i) =>
      i === subIndex ? { ...s, completed: !s.completed } : s
    );
    const allComplete = updatedSubtasks.every((s) => s.completed);

    if (!allComplete) {
      const updatedChallenges = data.challenges.map((c, i) =>
        i === index ? { ...c, subtasks: updatedSubtasks } : c
      );
      tx.update(aiRef, { challenges: updatedChallenges });
      return { subtasks: updatedSubtasks, completed: false };
    }

    const { updates, result: xpResult } = computeXpGain(userSnap.data(), challenge.xpReward);
    const updatedChallenges = data.challenges.map((c, i) =>
      i === index ? { ...c, subtasks: updatedSubtasks, status: 'completed' } : c
    );
    tx.update(aiRef, { challenges: updatedChallenges });
    tx.update(userRef, updates);

    return { subtasks: updatedSubtasks, completed: true, xp: xpResult };
  });

  if (result.completed) {
    evaluateTitles(userId).catch((e) => logger.error({ err: e, userId }, 'Title evaluation failed'));
    updateUserRank(userId).catch((e) => logger.error({ err: e, userId }, 'Rank update failed'));
  }

  return result;
}
```

Update `module.exports` (currently line 300) to:

```js
module.exports = { generateInsight, generateChallenges, acceptChallenge, completeAISuggestion, generateSubtasks, toggleSubtask };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest __tests__/aiChallengeActions.test.js`
Expected: PASS — all existing tests plus the new single-select/generateSubtasks/toggleSubtask tests.

- [ ] **Step 6: Add the two new routes**

In `backend/routes/aiRoutes.js`, update the import on line 4 to include the two new functions:

```js
const { generateInsight, generateChallenges, acceptChallenge, completeAISuggestion, generateSubtasks, toggleSubtask } = require('../services/ai.service');
```

Add after the existing `PATCH /challenges/:index/complete` route (currently lines 62-69):

```js
// POST /api/ai/challenges/:index/subtasks
router.post('/challenges/:index/subtasks', asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'index must be a non-negative integer' });
  }
  const subtasks = await generateSubtasks(req.userId, index);
  res.json({ subtasks });
}));

// PATCH /api/ai/challenges/:index/subtasks/:subIndex/toggle
router.patch('/challenges/:index/subtasks/:subIndex/toggle', asyncHandler(async (req, res) => {
  const index = Number(req.params.index);
  const subIndex = Number(req.params.subIndex);
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(subIndex) || subIndex < 0) {
    return res.status(400).json({ error: 'index and subIndex must be non-negative integers' });
  }
  const result = await toggleSubtask(req.userId, index, subIndex);
  res.json(result);
}));
```

- [ ] **Step 7: Run the full backend test suite**

Run: `cd backend && npx jest`
Expected: PASS — all suites, no regressions.

- [ ] **Step 8: Commit**

```bash
git add backend/services/ai.service.js backend/routes/aiRoutes.js backend/__tests__/aiChallengeActions.test.js
git commit -m "$(cat <<'EOF'
feat: add single-select invariant and AI checklist to Coach Suggests

Accepting one suggestion now locks out the other for the day. A new
generateSubtasks/toggleSubtask pair lets an accepted suggestion get a
3-5 item AI-generated checklist that auto-completes (and awards XP)
once every item is checked off.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Frontend — checklist UI, single-select lockout, API bindings

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/ChallengeSection.tsx`
- Test: `frontend/components/__tests__/ChallengeSection.test.tsx`

**Interfaces:**
- Consumes: `generateSubtasks(userId, index)` and `toggleSubtask(userId, index, subIndex)` response shapes from Task 1 (`{ subtasks: {title,completed}[] }` and `{ subtasks, completed, xp? }` respectively) — Task 1 must be complete and merged/available before this task starts, since these are real backend contracts, not mocked-only.
- Produces: `frontend/lib/api.ts` exports `generateSubtasks(index: number)` and `toggleSubtask(index: number, subIndex: number)`; `AISuggestion` interface gains `subtasks?: { title: string; completed: boolean }[]`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/components/__tests__/ChallengeSection.test.tsx` with:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeSection from '../ChallengeSection';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
const acceptAISuggestion = vi.fn().mockResolvedValue({ status: 'accepted' });
const generateSubtasks = vi.fn().mockResolvedValue({
  subtasks: [
    { title: 'Step one', completed: false },
    { title: 'Step two', completed: false },
  ],
});
const toggleSubtask = vi.fn();
const completeAISuggestion = vi.fn().mockResolvedValue({ completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

const firebaseUser = { uid: 'u1' };

vi.mock('@/context/ChallengeContext', () => ({
  useChallenges: () => ({
    challengeDoc: { id: 'doc-1', challenges: [], bonusAwarded: false },
    loading: false,
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser,
    refreshProfile,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchAIChallenges: vi.fn().mockResolvedValue({
    challenges: [
      { title: 'Daily Focus Protocol', description: 'Maintain focus sessions.', xpReward: 25, status: 'suggested' },
      { title: 'Optimize Sleep Cycle', description: 'Adjust bedtime routine.', xpReward: 20, status: 'suggested' },
    ],
  }),
  acceptAISuggestion: (...args: unknown[]) => acceptAISuggestion(...args),
  generateSubtasks: (...args: unknown[]) => generateSubtasks(...args),
  toggleSubtask: (...args: unknown[]) => toggleSubtask(...args),
  completeAISuggestion: (...args: unknown[]) => completeAISuggestion(...args),
}));

describe('ChallengeSection — AI suggestion cards', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    acceptAISuggestion.mockClear();
    generateSubtasks.mockClear();
    toggleSubtask.mockReset();
    completeAISuggestion.mockClear();
  });

  it('locks out the other suggestion once one is accepted', async () => {
    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    await waitFor(() => expect(acceptAISuggestion).toHaveBeenCalledWith(0));

    // The second suggestion is no longer a clickable button once the first is accepted
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Optimize Sleep Cycle/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Optimize Sleep Cycle/i)).toBeInTheDocument();
  });

  it('shows a generated checklist after accepting, and completes on the last checkbox', async () => {
    toggleSubtask
      .mockResolvedValueOnce({ subtasks: [{ title: 'Step one', completed: true }, { title: 'Step two', completed: false }], completed: false })
      .mockResolvedValueOnce({ subtasks: [{ title: 'Step one', completed: true }, { title: 'Step two', completed: true }], completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    const stepOne = await screen.findByRole('button', { name: 'Step one' });
    const stepTwo = await screen.findByRole('button', { name: 'Step two' });

    fireEvent.click(stepOne);
    await waitFor(() => expect(toggleSubtask).toHaveBeenCalledWith(0, 0));
    expect(refreshProfile).not.toHaveBeenCalled();

    fireEvent.click(stepTwo);
    await waitFor(() => expect(toggleSubtask).toHaveBeenCalledWith(0, 1));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
  });

  it('renders as completed immediately if the backend reports the suggestion was already completed elsewhere', async () => {
    acceptAISuggestion.mockResolvedValueOnce({ status: 'completed' });
    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    await waitFor(() => expect(screen.queryByRole('button', { name: /Daily Focus Protocol/i })).not.toBeInTheDocument());
    expect(generateSubtasks).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run components/__tests__/ChallengeSection.test.tsx`
Expected: FAIL — `generateSubtasks`/`toggleSubtask` aren't exported from `lib/api.ts` yet, and the current component has no locking/checklist behavior.

- [ ] **Step 3: Add the new API bindings and type**

In `frontend/lib/api.ts`, update `AISuggestion` (currently lines 496-501):

```ts
export interface AISuggestion {
  title: string;
  description: string;
  xpReward: number;
  status: 'suggested' | 'accepted' | 'completed';
  subtasks?: { title: string; completed: boolean }[];
}
```

Add after `completeAISuggestion` (currently ending at line 173):

```ts
export function generateSubtasks(index: number) {
  return apiFetch<{ subtasks: NonNullable<AISuggestion['subtasks']> }>(`/api/ai/challenges/${index}/subtasks`, {
    method: 'POST',
  });
}

export function toggleSubtask(index: number, subIndex: number) {
  return apiFetch<{ subtasks: NonNullable<AISuggestion['subtasks']>; completed: boolean; xp?: XPResult }>(
    `/api/ai/challenges/${index}/subtasks/${subIndex}/toggle`,
    { method: 'PATCH' }
  );
}
```

(`XPResult` is already imported/defined elsewhere in this file for `completeAISuggestion`'s return type — reuse it, don't redefine.)

- [ ] **Step 4: Restructure `ChallengeSection.tsx`**

Update the import on line 8:

```tsx
import { DailyChallenge, AISuggestion, fetchAIChallenges, acceptAISuggestion, generateSubtasks, toggleSubtask, completeAISuggestion } from '@/lib/api';
```

Replace `markAccepted`/`markCompleted` (currently lines 35-45) with:

```tsx
  function markAccepted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'accepted' } : s))
    );
  }

  function markSubtasksGenerated(index: number, subtasks: AISuggestion['subtasks']) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, subtasks } : s))
    );
  }

  function markSubtaskToggled(index: number, subtasks: AISuggestion['subtasks']) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, subtasks } : s))
    );
  }

  function markCompleted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'completed' } : s))
    );
  }
```

Update the suggestion-rendering block (currently lines 138-148):

```tsx
            <div className="space-y-2">
              {aiSuggestions.map((s, i) => {
                const selectedIndex = aiSuggestions.findIndex((x) => x.status !== 'suggested');
                return (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    index={i}
                    isLocked={selectedIndex !== -1 && selectedIndex !== i}
                    onAccepted={markAccepted}
                    onSubtasksGenerated={markSubtasksGenerated}
                    onSubtaskToggled={markSubtaskToggled}
                    onCompleted={markCompleted}
                  />
                );
              })}
            </div>
```

Replace the entire `SuggestionCard` function (currently lines 234-311) with:

```tsx
function SuggestionCard({
  suggestion,
  index,
  isLocked,
  onAccepted,
  onSubtasksGenerated,
  onSubtaskToggled,
  onCompleted,
}: {
  suggestion: AISuggestion;
  index: number;
  isLocked: boolean;
  onAccepted: (index: number) => void;
  onSubtasksGenerated: (index: number, subtasks: AISuggestion['subtasks']) => void;
  onSubtaskToggled: (index: number, subtasks: AISuggestion['subtasks']) => void;
  onCompleted: (index: number) => void;
}) {
  const { refreshProfile } = useAuth();
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false);
  const isAccepted = suggestion.status === 'accepted';
  const isCompleted = suggestion.status === 'completed';
  const hasSubtasks = Boolean(suggestion.subtasks?.length);

  async function handleAccept() {
    if (suggestion.status !== 'suggested' || isLocked) return;
    const res = await acceptAISuggestion(index);
    if (res.status === 'completed') {
      onCompleted(index);
      return;
    }
    onAccepted(index);
    setGeneratingSubtasks(true);
    try {
      const { subtasks } = await generateSubtasks(index);
      onSubtasksGenerated(index, subtasks);
    } finally {
      setGeneratingSubtasks(false);
    }
  }

  async function handleToggleSubtask(subIndex: number) {
    const res = await toggleSubtask(index, subIndex);
    onSubtaskToggled(index, res.subtasks);
    if (res.completed) {
      onCompleted(index);
      await refreshProfile();
    }
  }

  const iconWrapClasses = `w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
    isCompleted
      ? 'border-accent bg-accent'
      : isAccepted
      ? 'border-accent-light bg-accent/30'
      : 'border-accent/40'
  }`;

  const body = (
    <>
      <div className={iconWrapClasses}>
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

        {isAccepted && generatingSubtasks && (
          <div className="mt-2 space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-accent/10 rounded animate-pulse" />
            ))}
          </div>
        )}

        {isAccepted && hasSubtasks && (
          <ul className="mt-2 space-y-1.5">
            {suggestion.subtasks!.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleToggleSubtask(i)}
                  disabled={s.completed}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                      s.completed ? 'border-accent bg-accent' : 'border-accent/40'
                    }`}
                  >
                    {s.completed && (
                      <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={`text-[11px] ${s.completed ? 'text-muted line-through' : 'text-white/80'}`}>
                    {s.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className={`text-xs font-medium shrink-0 ${isCompleted ? 'text-muted' : 'text-accent-light/70'}`}>
        +{suggestion.xpReward} XP
      </span>
    </>
  );

  // A locked-but-still-'suggested' card (the sibling of whichever one got
  // accepted) must NOT be a <button> at all, even a disabled one — a
  // disabled button still exposes role="button" in the accessibility tree,
  // which would make it indistinguishable from an interactive card to
  // anything querying by role. Only a truly selectable card is a <button>;
  // every other state (locked, accepted, completed) is an inert <div>.
  if (suggestion.status === 'suggested' && !isLocked) {
    return (
      <button
        onClick={handleAccept}
        className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all border-accent/20 bg-accent/5 hover:bg-accent/10 cursor-pointer"
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        isCompleted || isLocked ? 'border-border/30 bg-surface/30' : 'border-accent/40 bg-accent/10'
      } ${isLocked ? 'opacity-50' : ''}`}
    >
      {body}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run components/__tests__/ChallengeSection.test.tsx`
Expected: PASS — all 3 tests.

- [ ] **Step 6: Type-check the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — no regressions in any other test file.

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/api.ts frontend/components/ChallengeSection.tsx frontend/components/__tests__/ChallengeSection.test.tsx
git commit -m "$(cat <<'EOF'
feat: single-select lockout + AI checklist UI for Coach Suggests

Accepting one suggestion visually locks out the other. The card now
shows a generated checklist after acceptance instead of a "tap to
complete" hint -- checking off every item completes the suggestion.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Manual Verification (after both tasks)

Since this changes a core interactive UI flow, confirm it in the running app:

1. With both dev servers running, open the Dashboard and find the "Coach Suggests" section (requires at least one of the 2 daily AI suggestions to still be in `'suggested'` state — may need to wait for the next day's cache or manually reset the `aiCache/{userId}` doc's `challenges[*].status` back to `'suggested'` in Firestore for testing).
2. Tap one suggestion — confirm the other becomes visibly disabled/locked immediately.
3. Confirm a brief loading state appears, then a checklist of 3-5 items renders inside the accepted card.
4. Check off items one at a time — confirm XP/level does *not* change until the last one.
5. Check off the last item — confirm the suggestion transitions to its completed visual state and the header XP/level updates (via `refreshProfile`).
