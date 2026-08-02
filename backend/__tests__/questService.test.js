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

describe('wereAllQuestsCompleted', () => {
  test('returns true when every quest for that day is completed', async () => {
    const { wereAllQuestsCompleted } = require('../services/questService');
    const userId = 'user-1';
    const date = '2026-08-01';
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_push_ups', date, completed: true });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_running', date, completed: true });

    await expect(wereAllQuestsCompleted(userId, date)).resolves.toBe(true);
  });

  test('returns false when at least one quest for that day is incomplete', async () => {
    const { wereAllQuestsCompleted } = require('../services/questService');
    const userId = 'user-1';
    const date = '2026-08-01';
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_push_ups', date, completed: true });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_running', date, completed: false });

    await expect(wereAllQuestsCompleted(userId, date)).resolves.toBe(false);
  });

  test('returns true when a custom quest is included and all (default + custom) are completed', async () => {
    const { wereAllQuestsCompleted } = require('../services/questService');
    const userId = 'user-1';
    const date = '2026-08-01';
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'default_push_ups', date, completed: true });
    await mockFakeDb.collection('dailyQuests').add({ userId, questId: 'custom-abc', date, completed: true });

    await expect(wereAllQuestsCompleted(userId, date)).resolves.toBe(true);
  });

  test('returns false when there are no dailyQuests docs at all for that date', async () => {
    const { wereAllQuestsCompleted } = require('../services/questService');
    await expect(wereAllQuestsCompleted('user-1', '2026-08-01')).resolves.toBe(false);
  });
});
