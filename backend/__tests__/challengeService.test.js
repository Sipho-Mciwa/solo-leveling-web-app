const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
let mockDoubleXpActive;

jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

jest.mock('../services/xpService', () => {
  const actual = jest.requireActual('../services/xpService');
  return { ...actual, isDoubleXpActive: (userId) => mockDoubleXpActive(userId) };
});

jest.mock('../services/titleService', () => ({ evaluateTitles: jest.fn().mockResolvedValue() }));
jest.mock('../services/rankService', () => ({ updateUserRank: jest.fn().mockResolvedValue() }));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  mockDoubleXpActive = () => false;
  jest.resetModules();
});

async function seedChallenges(userId, date) {
  const { CHALLENGES } = require('../services/challengeService');
  const docId = `${userId}_${date}`;
  await mockFakeDb.collection('dailyChallenges').doc(docId).set({
    userId,
    date,
    challenges: CHALLENGES.map((c) => ({ ...c, completed: false })),
    bonusAwarded: false,
  });
  return docId;
}

describe('completeChallenge', () => {
  test('awards the base XP reward when double XP is not active', async () => {
    const { completeChallenge } = require('../services/challengeService');
    const userId = 'user-1';
    const date = '2026-08-01';
    const docId = await seedChallenges(userId, date);
    await mockFakeDb.collection('users').doc(userId).set({ xp: 0, level: 1 });

    const result = await completeChallenge(docId, userId, 'make_bed');

    expect(result.xp.xpGained).toBe(10);
  });

  test('doubles the base XP reward when double XP is active', async () => {
    mockDoubleXpActive = () => true;
    const { completeChallenge } = require('../services/challengeService');
    const userId = 'user-1';
    const date = '2026-08-01';
    const docId = await seedChallenges(userId, date);
    await mockFakeDb.collection('users').doc(userId).set({ xp: 0, level: 1 });

    const result = await completeChallenge(docId, userId, 'make_bed');

    expect(result.xp.xpGained).toBe(20);
  });

  test('doubles the all-complete bonus XP too when double XP is active', async () => {
    mockDoubleXpActive = () => true;
    const { completeChallenge, CHALLENGES } = require('../services/challengeService');
    const userId = 'user-1';
    const date = '2026-08-01';
    const docId = await mockFakeDb
      .collection('dailyChallenges')
      .doc(`${userId}_${date}`)
      .set({
        userId,
        date,
        challenges: CHALLENGES.map((c, i) => ({ ...c, completed: i < CHALLENGES.length - 1 })),
        bonusAwarded: false,
      })
      .then(() => `${userId}_${date}`);
    await mockFakeDb.collection('users').doc(userId).set({ xp: 0, level: 1 });

    const lastChallenge = CHALLENGES[CHALLENGES.length - 1];
    const result = await completeChallenge(docId, userId, lastChallenge.key);

    expect(result.bonusAwarded).toBe(true);
    expect(result.bonusXp.xpGained).toBe(200); // ALL_COMPLETE_BONUS (100) doubled
  });
});
