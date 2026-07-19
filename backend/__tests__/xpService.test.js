jest.mock('../config/firebase', () => ({ db: {}, auth: {} }));

const { computeXpGain, xpRequiredForLevel, getTotalXp } = require('../services/xpService');

describe('computeXpGain', () => {
  test('adds XP without leveling up', () => {
    const user = { xp: 10, level: 1 };
    const { result } = computeXpGain(user, 20);
    expect(result.xp).toBe(30);
    expect(result.level).toBe(1);
    expect(result.leveledUp).toBe(false);
    expect(result.xpGained).toBe(20);
    expect(result.previousLevel).toBe(1);
  });

  test('levels up once when XP crosses the threshold', () => {
    const required = xpRequiredForLevel(1);
    const user = { xp: required - 5, level: 1 };
    const { result } = computeXpGain(user, 10);
    expect(result.level).toBe(2);
    expect(result.leveledUp).toBe(true);
    expect(result.xp).toBe(5);
  });

  test('handles multiple level-ups from a single large XP gain', () => {
    const user = { xp: 0, level: 1 };
    const { result } = computeXpGain(user, xpRequiredForLevel(1) + xpRequiredForLevel(2) + 15);
    expect(result.level).toBe(3);
    expect(result.xp).toBe(15);
  });

  test('clamps XP at zero on a penalty deduction larger than current XP', () => {
    const user = { xp: 10, level: 1 };
    const { result } = computeXpGain(user, -50);
    expect(result.xp).toBe(0);
    expect(result.level).toBe(1);
  });

  test('defaults missing xp/level fields to 0/1', () => {
    const { result } = computeXpGain({}, 5);
    expect(result.xp).toBe(5);
    expect(result.level).toBe(1);
    expect(result.previousLevel).toBe(1);
  });
});

describe('getTotalXp', () => {
  test('sums required XP for all completed levels plus remainder', () => {
    const total = getTotalXp(3, 15);
    expect(total).toBe(xpRequiredForLevel(1) + xpRequiredForLevel(2) + 15);
  });

  test('returns just the remainder at level 1', () => {
    expect(getTotalXp(1, 42)).toBe(42);
  });
});
