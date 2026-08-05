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
