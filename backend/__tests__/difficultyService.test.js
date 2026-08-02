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

describe('calculateDifficultyMultiplier', () => {
  test('streak of 0 stays at base (1.0x)', () => {
    const { calculateDifficultyMultiplier } = require('../services/difficultyService');
    expect(calculateDifficultyMultiplier(0)).toBe(1.0);
  });

  test('a single-day or two-day streak does not spike the multiplier', () => {
    const { calculateDifficultyMultiplier } = require('../services/difficultyService');
    expect(calculateDifficultyMultiplier(1)).toBe(1.0);
    expect(calculateDifficultyMultiplier(2)).toBe(1.0);
  });

  test('3-day streak grants a 5% bump', () => {
    const { calculateDifficultyMultiplier } = require('../services/difficultyService');
    expect(calculateDifficultyMultiplier(3)).toBeCloseTo(1.05);
  });

  test('9-day streak grants a 15% bump', () => {
    const { calculateDifficultyMultiplier } = require('../services/difficultyService');
    expect(calculateDifficultyMultiplier(9)).toBeCloseTo(1.15);
  });

  test('caps at 1.5x regardless of how long the streak runs', () => {
    const { calculateDifficultyMultiplier } = require('../services/difficultyService');
    expect(calculateDifficultyMultiplier(30)).toBeCloseTo(1.5);
    expect(calculateDifficultyMultiplier(100)).toBeCloseTo(1.5);
  });
});

describe('calculatePerQuestStreaks', () => {
  test('counts consecutive completed days ending yesterday', async () => {
    const { calculatePerQuestStreaks } = require('../services/difficultyService');
    const userId = 'user-1';
    for (let n = 1; n <= 3; n++) {
      await mockFakeDb.collection('dailyQuests').add({
        userId, questId: 'default_push_ups', date: daysAgoStr(n), completed: true,
      });
    }
    const streaks = await calculatePerQuestStreaks(userId, ['default_push_ups']);
    expect(streaks.default_push_ups).toBe(3);
  });

  test('stops counting at a gap day with no doc', async () => {
    const { calculatePerQuestStreaks } = require('../services/difficultyService');
    const userId = 'user-1';
    await mockFakeDb.collection('dailyQuests').add({
      userId, questId: 'default_push_ups', date: daysAgoStr(1), completed: true,
    });
    // day 2 has no doc at all (a gap)
    await mockFakeDb.collection('dailyQuests').add({
      userId, questId: 'default_push_ups', date: daysAgoStr(3), completed: true,
    });

    const streaks = await calculatePerQuestStreaks(userId, ['default_push_ups']);
    expect(streaks.default_push_ups).toBe(1);
  });

  test('stops counting at a day logged but not completed', async () => {
    const { calculatePerQuestStreaks } = require('../services/difficultyService');
    const userId = 'user-1';
    await mockFakeDb.collection('dailyQuests').add({
      userId, questId: 'default_push_ups', date: daysAgoStr(1), completed: true,
    });
    await mockFakeDb.collection('dailyQuests').add({
      userId, questId: 'default_push_ups', date: daysAgoStr(2), completed: false,
    });

    const streaks = await calculatePerQuestStreaks(userId, ['default_push_ups']);
    expect(streaks.default_push_ups).toBe(1);
  });

  test('defaults to 0 for a quest with no history', async () => {
    const { calculatePerQuestStreaks } = require('../services/difficultyService');
    const streaks = await calculatePerQuestStreaks('user-1', ['default_running']);
    expect(streaks.default_running).toBe(0);
  });
});

describe('generateScaledTarget', () => {
  test('rounds to a whole number by default (reps-based quests)', () => {
    const { generateScaledTarget } = require('../services/difficultyService');
    expect(generateScaledTarget(20, 1.05)).toBe(21);
    expect(generateScaledTarget(20, 1.1)).toBe(22);
  });

  test('rounds to 1 decimal place when requested (distance-based quests)', () => {
    const { generateScaledTarget } = require('../services/difficultyService');
    expect(generateScaledTarget(5, 1.05, 1)).toBe(5.3);
    expect(generateScaledTarget(5, 1.1, 1)).toBe(5.5);
  });
});

describe('applyDifficultyScaling', () => {
  function fakeQuestDoc(id, targetValue) {
    return { id, data: () => ({ targetValue }) };
  }

  test('never scales below base target when there is no qualifying streak', async () => {
    const { applyDifficultyScaling } = require('../services/difficultyService');
    const results = await applyDifficultyScaling('user-1', [fakeQuestDoc('default_push_ups', 20)]);
    expect(results[0].currentTarget).toBe(20);
    expect(results[0].difficultyMultiplier).toBe(1.0);
  });

  test('a single completed day does not move the target off base', async () => {
    const { applyDifficultyScaling } = require('../services/difficultyService');
    const userId = 'user-1';
    await mockFakeDb.collection('dailyQuests').add({
      userId, questId: 'default_running', date: daysAgoStr(1), completed: true,
    });
    const results = await applyDifficultyScaling(userId, [fakeQuestDoc('default_running', 5)]);
    expect(results[0].currentTarget).toBe(5);
    expect(results[0].difficultyMultiplier).toBe(1.0);
  });

  test('scales up once a 3-day qualifying streak is reached', async () => {
    const { applyDifficultyScaling } = require('../services/difficultyService');
    const userId = 'user-1';
    for (let n = 1; n <= 3; n++) {
      await mockFakeDb.collection('dailyQuests').add({
        userId, questId: 'default_push_ups', date: daysAgoStr(n), completed: true,
      });
    }
    const results = await applyDifficultyScaling(userId, [fakeQuestDoc('default_push_ups', 20)]);
    expect(results[0].currentTarget).toBe(21); // round(20 * 1.05)
    expect(results[0].difficultyMultiplier).toBe(1.05);
  });

  test('scales running (distance-based) targets in fine 1-decimal-place steps', async () => {
    const { applyDifficultyScaling } = require('../services/difficultyService');
    const userId = 'user-1';
    for (let n = 1; n <= 3; n++) {
      await mockFakeDb.collection('dailyQuests').add({
        userId, questId: 'default_running', date: daysAgoStr(n), completed: true,
      });
    }
    const results = await applyDifficultyScaling(userId, [fakeQuestDoc('default_running', 5)]);
    expect(results[0].currentTarget).toBe(5.3); // round(5 * 1.05 * 10) / 10
    expect(results[0].difficultyMultiplier).toBe(1.05);
  });

  test('reps-based quests are unaffected by the decimal-precision change', async () => {
    const { applyDifficultyScaling } = require('../services/difficultyService');
    const userId = 'user-1';
    for (let n = 1; n <= 3; n++) {
      await mockFakeDb.collection('dailyQuests').add({
        userId, questId: 'default_push_ups', date: daysAgoStr(n), completed: true,
      });
    }
    const results = await applyDifficultyScaling(userId, [fakeQuestDoc('default_push_ups', 20)]);
    expect(results[0].currentTarget).toBe(21);
  });
});
