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
  // Force the deterministic no-API-key fallback path for any test that
  // exercises callAI (generateSubtasks) — matches the convention already
  // used in __tests__/aiSuggestionStatus.test.js. We're not testing LLM
  // integration, just that generateSubtasks correctly parses whatever
  // string callAI returns and persists it.
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
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

  test('treats a missing status field as suggested (pre-feature cached data)', async () => {
    const { acceptChallenge } = require('../services/ai.service');
    const userId = 'user-9';

    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20 }], // no status field at all
    });

    const result = await acceptChallenge(userId, 0);
    expect(result.status).toBe('accepted');

    const snap = await mockFakeDb.collection('aiCache').doc(userId).get();
    expect(snap.data().challenges[0].status).toBe('accepted');
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

  test('treats a missing status field as suggested, so completing it directly throws 409', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-10';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{ title: 'Test', description: 'Do it', xpReward: 20 }], // no status field at all
    });

    await expect(completeAISuggestion(userId, 0)).rejects.toMatchObject({ status: 409 });
  });

  test('throws 409 when the accepted suggestion has a non-empty checklist (must complete via checklist, not this route)', async () => {
    const { completeAISuggestion } = require('../services/ai.service');
    const userId = 'user-22';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });
    await mockFakeDb.collection('aiCache').doc(userId).set({
      date: todayStr(),
      insight: null,
      challenges: [{
        title: 'Test', description: 'Do it', xpReward: 20, status: 'accepted',
        subtasks: [{ title: 'A', completed: false }, { title: 'B', completed: false }],
      }],
    });

    await expect(completeAISuggestion(userId, 0)).rejects.toMatchObject({ status: 409 });

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    expect(userSnap.data().xp).toBe(0); // no XP bypass
  });
});

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
