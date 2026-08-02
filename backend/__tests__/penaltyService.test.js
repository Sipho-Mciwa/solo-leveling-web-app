const { createFakeDb } = require('../test-helpers/fakeFirestore');

let mockFakeDb;
jest.mock('../config/firebase', () => ({
  get db() { return mockFakeDb; },
  auth: {},
}));

beforeEach(() => {
  mockFakeDb = createFakeDb();
  jest.resetModules();
});

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

describe('generatePenalty', () => {
  test('fires a penalty when only some of yesterday\'s quests were completed', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-1';
    const yesterday = yesterdayStr();

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, lastActiveDate: yesterday });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_push_ups', date: yesterday, completed: true });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_running', date: yesterday, completed: false });

    const result = await generatePenalty(userId);
    expect(result.generated).toBe(true);
  });

  test('does not fire a penalty when all of yesterday\'s quests (including a custom one) were completed', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-1';
    const yesterday = yesterdayStr();

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, lastActiveDate: yesterday });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_push_ups', date: yesterday, completed: true });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'custom-abc', date: yesterday, completed: true });

    const result = await generatePenalty(userId);
    expect(result.generated).toBe(false);
    expect(result.message).toBe('No missed days');
  });

  test('fires a penalty when the user never opened the app yesterday (no dailyQuests docs at all)', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-1';
    const twoDaysAgo = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      return d.toISOString().split('T')[0];
    })();

    await mockFakeDb.collection('users').doc(userId).set({ level: 1, lastActiveDate: twoDaysAgo });
    // No dailyQuests docs created for yesterday at all.

    const result = await generatePenalty(userId);
    expect(result.generated).toBe(true);
  });

  test('does not fire a penalty for a brand-new user with no lastActiveDate ever', async () => {
    const { generatePenalty } = require('../services/penaltyService');
    const userId = 'user-1';

    await mockFakeDb.collection('users').doc(userId).set({ level: 1 });
    // No lastActiveDate field at all — brand new account.

    const result = await generatePenalty(userId);
    expect(result.generated).toBe(false);
    expect(result.message).toBe('No missed days');
  });
});
