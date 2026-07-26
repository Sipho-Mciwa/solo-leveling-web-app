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

async function seedQuestTemplates(db) {
  await db.collection('quests').doc('default_push_ups').set({ title: 'Push-ups' });
  await db.collection('quests').doc('default_squats').set({ title: 'Squats' });
  await db.collection('quests').doc('default_running').set({ title: 'Running' });
}

async function seedDailyQuest(db, userId, { questId, date, currentValue }) {
  await db.collection('dailyQuests').doc(`${userId}_${date}_${questId}`).set({
    userId, questId, date, currentValue,
  });
}

describe('getHunterRecords', () => {
  test('sums same-day reps across quests and picks the best day', async () => {
    const { getHunterRecords } = require('../services/hunterRecordsService');
    await seedQuestTemplates(mockFakeDb);

    // Day 1: 20 push-ups + 15 squats = 35
    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_push_ups', date: '2026-07-01', currentValue: 20 });
    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_squats',   date: '2026-07-01', currentValue: 15 });
    // Day 2: 30 push-ups alone — less than day 1's combined total
    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_push_ups', date: '2026-07-02', currentValue: 30 });

    const records = await getHunterRecords('u1');
    expect(records.mostRepsInADay).toEqual({ value: 35, date: '2026-07-01' });
  });

  test('longest run tracks a single day\'s max, not a sum', async () => {
    const { getHunterRecords } = require('../services/hunterRecordsService');
    await seedQuestTemplates(mockFakeDb);

    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_running', date: '2026-07-01', currentValue: 5 });
    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_running', date: '2026-07-02', currentValue: 12 });
    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_running', date: '2026-07-03', currentValue: 8 });

    const records = await getHunterRecords('u1');
    expect(records.longestRun).toEqual({ value: 12, date: '2026-07-02' });
  });

  test('ignores zero/negative entries', async () => {
    const { getHunterRecords } = require('../services/hunterRecordsService');
    await seedQuestTemplates(mockFakeDb);

    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_push_ups', date: '2026-07-01', currentValue: 0 });

    const records = await getHunterRecords('u1');
    expect(records.mostRepsInADay).toBeNull();
    expect(records.longestRun).toBeNull();
  });

  test('only aggregates the requested user\'s docs', async () => {
    const { getHunterRecords } = require('../services/hunterRecordsService');
    await seedQuestTemplates(mockFakeDb);

    await seedDailyQuest(mockFakeDb, 'u1', { questId: 'default_push_ups', date: '2026-07-01', currentValue: 20 });
    await seedDailyQuest(mockFakeDb, 'u2', { questId: 'default_push_ups', date: '2026-07-01', currentValue: 999 });

    const records = await getHunterRecords('u1');
    expect(records.mostRepsInADay.value).toBe(20);
  });

  test('longestStreak comes from userMemory, null when it has never run', async () => {
    const { getHunterRecords } = require('../services/hunterRecordsService');

    const withoutMemory = await getHunterRecords('u1');
    expect(withoutMemory.longestStreak).toBeNull();

    await mockFakeDb.collection('userMemory').doc('u1').set({ streakHistory: { longestStreak: 14 } });
    const withMemory = await getHunterRecords('u1');
    expect(withMemory.longestStreak).toBe(14);
  });
});
