jest.mock('../config/firebase', () => ({ db: {}, auth: {} }));

const { computeStreakUpdate } = require('../services/streakService');

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

describe('computeStreakUpdate', () => {
  test('no-ops if already counted today', () => {
    const user = { lastActiveDate: daysAgoStr(0), streakCount: 5 };
    const { updates, result } = computeStreakUpdate(user);
    expect(updates).toEqual({});
    expect(result.streakCount).toBe(5);
  });

  test('increments streak when last active was yesterday', () => {
    const user = { lastActiveDate: daysAgoStr(1), streakCount: 5 };
    const { updates, result } = computeStreakUpdate(user);
    expect(result.streakCount).toBe(6);
    expect(updates.streakCount).toBe(6);
    expect(updates.recoverCount).toBeUndefined();
  });

  test('resets streak to 1 after a missed day and tracks recovery', () => {
    const user = { lastActiveDate: daysAgoStr(3), streakCount: 5 };
    const { updates, result } = computeStreakUpdate(user);
    expect(result.streakCount).toBe(1);
    expect(updates.recoverCount).toBe(1);
  });

  test('starts a fresh streak with no recovery increment when there was no prior streak', () => {
    const user = { lastActiveDate: null, streakCount: 0 };
    const { updates, result } = computeStreakUpdate(user);
    expect(result.streakCount).toBe(1);
    expect(updates.recoverCount).toBeUndefined();
  });
});
