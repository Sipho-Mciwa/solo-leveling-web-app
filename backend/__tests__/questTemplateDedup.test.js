// Regression coverage for a real duplicate-quest bug found in production
// data: the `quests` collection had 24 template docs — 6 duplicate copies
// each of Sit-ups/Push-ups/Squats/Running, only 4 of which were the
// canonical deterministic `default_*` docs. generateDailyQuests merged
// templates by doc ID, so all 24 distinct-ID-but-same-title docs survived
// and each spawned its own daily quest for the same habit. The fix dedupes
// non-custom templates by title, preferring the `default_*` doc.

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

async function seedLegacyDuplicateTemplates(db) {
  // Mirrors the real shape found in production: a clean deterministic
  // `default_*` doc plus several stray random-ID duplicates of the same
  // title, all with the legacy `userId: null` shape and no `isGlobal` flag.
  const templates = [
    ['default_squats', { title: 'Squats', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false, userId: null }],
    ['stray1', { title: 'Squats', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false, userId: null }],
    ['stray2', { title: 'Squats', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false, userId: null }],
    ['default_running', { title: 'Running', type: 'fitness', targetValue: 5, xpReward: 50, isCustom: false, userId: null }],
    ['stray3', { title: 'Running', type: 'fitness', targetValue: 5, xpReward: 50, isCustom: false, userId: null }],
  ];
  for (const [id, data] of templates) {
    await db.collection('quests').doc(id).set(data);
  }
}

describe('generateDailyQuests template dedup', () => {
  test('collapses duplicate-title templates into one daily quest each, preferring the default_* doc', async () => {
    const { generateDailyQuests } = require('../services/questService');
    const userId = 'user-1';

    await seedLegacyDuplicateTemplates(mockFakeDb);
    await mockFakeDb.collection('users').doc(userId).set({ level: 1, streakCount: 0 });

    await generateDailyQuests(userId);

    const snap = await mockFakeDb.collection('dailyQuests').where('userId', '==', userId).get();
    expect(snap.size).toBe(2); // Squats + Running, not 5

    const questIds = snap.docs.map((d) => d.data().questId);
    expect(questIds).toContain('default_squats');
    expect(questIds).toContain('default_running');
    expect(questIds).not.toContain('stray1');
    expect(questIds).not.toContain('stray2');
    expect(questIds).not.toContain('stray3');
  });

  test('never dedupes custom quests, even if the title matches a default', async () => {
    const { generateDailyQuests } = require('../services/questService');
    const userId = 'user-2';

    await mockFakeDb.collection('quests').doc('default_squats').set({
      title: 'Squats', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false, userId: null,
    });
    await mockFakeDb.collection('quests').doc('custom-squats').set({
      title: 'Squats', type: 'fitness', targetValue: 40, xpReward: 60, isCustom: true, userId,
    });
    await mockFakeDb.collection('users').doc(userId).set({ level: 1, streakCount: 0 });

    await generateDailyQuests(userId);

    const snap = await mockFakeDb.collection('dailyQuests').where('userId', '==', userId).get();
    const questIds = snap.docs.map((d) => d.data().questId);
    expect(questIds.sort()).toEqual(['custom-squats', 'default_squats']);
  });
});
