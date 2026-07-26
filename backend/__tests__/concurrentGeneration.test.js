// Regression coverage for a real duplicate-quest bug: generateDailyQuests
// (and its siblings generateDailyChallenges/generatePenalty) did a
// check-then-write with no locking. onAuthStateChanged firing more than
// once on login (tab refresh, token refresh, re-render) could call these
// concurrently — each call sees "not generated yet" before the other
// commits, so with random doc IDs every call created its own duplicate set.
// The fix is deterministic per-user/date doc IDs, which these tests verify
// by actually racing two calls against an in-memory Firestore stand-in
// rather than asserting on mocked call arguments.

const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  // Service modules destructure `const { db } = require(...)` at load time,
  // so Node's module cache would otherwise pin whichever fake db instance
  // was live the first time a service got required — every later test's
  // fresh mockFakeDb would silently be ignored by the (already-loaded)
  // service module. Resetting the registry forces each test's `require`
  // to re-evaluate that destructure against the current mockFakeDb.
  jest.resetModules();
});

describe('generateDailyQuests concurrency', () => {
  test('two concurrent calls on first login produce one quest set, not two', async () => {
    const { generateDailyQuests } = require('../services/questService');
    const userId = 'user-1';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, streakCount: 0 });

    await Promise.all([generateDailyQuests(userId), generateDailyQuests(userId)]);

    const snap = await mockFakeDb.collection('dailyQuests').where('userId', '==', userId).get();
    const titles = snap.docs.map((d) => d.data().questId);

    // 4 default quests, each exactly once — not 8
    expect(snap.size).toBe(4);
    expect(new Set(titles).size).toBe(4);
  });
});

describe('generateDailyChallenges concurrency', () => {
  test('two concurrent calls produce one challenges doc for the day, not two', async () => {
    const { generateDailyChallenges } = require('../services/challengeService');
    const userId = 'user-2';

    await Promise.all([generateDailyChallenges(userId), generateDailyChallenges(userId)]);

    const snap = await mockFakeDb.collection('dailyChallenges').where('userId', '==', userId).get();
    expect(snap.size).toBe(1);
  });
});

describe('generatePenalty concurrency', () => {
  test('two concurrent calls produce one penalty doc for the day, not two', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-3';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, xp: 0 });

    await Promise.all([generatePenalty(userId), generatePenalty(userId)]);

    const snap = await mockFakeDb.collection('penaltyQuests').where('userId', '==', userId).get();
    expect(snap.size).toBe(0); // no missed days for a brand-new user -> nothing generated at all
  });

  test('a stale unclaimed penalty is only deducted once, even when two calls race on expiring it', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-4';

    // level 5 / xp 300 is comfortably below its level-up threshold either way,
    // so a wrong double-deduction is observable rather than masked by the
    // zero-floor clamp or an incidental level-up boundary.
    await mockFakeDb.collection('users').doc(userId).set({ level: 5, xp: 300, lastActiveDate: '2020-01-01' });
    await mockFakeDb.collection('penaltyQuests').doc('stale-1').set({
      userId,
      date: '2020-01-01',
      xpPenalty: 50,
      completed: false,
      expired: false,
    });

    await Promise.all([generatePenalty(userId), generatePenalty(userId)]);

    const userSnap = await mockFakeDb.collection('users').doc(userId).get();
    // Deducted exactly once (300 - 50 = 250), not twice (200)
    expect(userSnap.data().xp).toBe(250);

    const staleSnap = await mockFakeDb.collection('penaltyQuests').doc('stale-1').get();
    expect(staleSnap.data().expired).toBe(true);
  });
});
