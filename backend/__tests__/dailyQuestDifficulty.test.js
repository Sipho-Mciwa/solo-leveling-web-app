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

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

describe('generateDailyQuests difficulty scaling', () => {
  test('a brand-new user gets base targets, not a spiked or shrunk value', async () => {
    const { generateDailyQuests } = require('../services/questService');
    const userId = 'user-1';
    await mockFakeDb.collection('users').doc(userId).set({ level: 1, streakCount: 0 });

    await generateDailyQuests(userId);

    const snap = await mockFakeDb.collection('dailyQuests').where('userId', '==', userId).get();
    const pushUps = snap.docs.map((d) => d.data()).find((d) => d.questId === 'default_push_ups');
    const running = snap.docs.map((d) => d.data()).find((d) => d.questId === 'default_running');
    expect(pushUps.currentTarget).toBe(20);
    expect(running.currentTarget).toBe(5);
  });

  test('a 3-day completion streak raises tomorrow\'s target by 5%', async () => {
    const { generateDailyQuests } = require('../services/questService');
    const userId = 'user-1';
    await mockFakeDb.collection('users').doc(userId).set({ level: 1, streakCount: 3 });
    for (let n = 1; n <= 3; n++) {
      await mockFakeDb.collection('dailyQuests').add({
        userId, questId: 'default_push_ups', date: daysAgoStr(n), completed: true, targetValue: 20,
      });
    }

    await generateDailyQuests(userId);

    const snap = await mockFakeDb.collection('dailyQuests').where('userId', '==', userId).where('date', '==', daysAgoStr(0)).get();
    const pushUps = snap.docs.map((d) => d.data()).find((d) => d.questId === 'default_push_ups');
    expect(pushUps.currentTarget).toBe(21);
  });
});
