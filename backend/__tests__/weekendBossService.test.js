jest.mock('../config/firebase', () => ({ db: {}, auth: {} }));

const { computeOverperformanceBonus, computeBossHistory } = require('../services/weekendBossService');

function boss(xpReward, minValue) {
  return { xpReward, requirements: { minValue } };
}

describe('computeOverperformanceBonus', () => {
  test('returns 0 when the submission exactly meets the minimum', () => {
    expect(computeOverperformanceBonus(boss(400, 6), 6)).toBe(0);
  });

  test('returns 0 when the submission is below the minimum', () => {
    expect(computeOverperformanceBonus(boss(400, 6), 4)).toBe(0);
  });

  test('scales linearly with how far the submission exceeds the minimum', () => {
    // 9 / 6 = 50% over minValue -> 50% of xpReward
    expect(computeOverperformanceBonus(boss(400, 6), 9)).toBe(200);
  });

  test('caps the bonus at 75% of the base reward', () => {
    // 200% over minValue would be a 200% bonus uncapped -> capped at 75%
    expect(computeOverperformanceBonus(boss(400, 6), 18)).toBe(300);
  });

  test('floors fractional XP amounts', () => {
    // 10% over minValue on a 350 reward -> 35 XP exactly, still an integer
    // use a case that doesn't divide evenly to exercise the floor
    expect(computeOverperformanceBonus(boss(350, 7), 7.5)).toBe(Math.floor(350 * (0.5 / 7)));
  });
});

function entry(weekendId, status) {
  return { weekendId, status };
}

describe('computeBossHistory', () => {
  test('excludes the current in-progress weekend', () => {
    const docs = [entry('2026-07-25', 'active'), entry('2026-07-18', 'claimed')];
    const { history } = computeBossHistory(docs, '2026-07-25', 20);
    expect(history).toEqual([entry('2026-07-18', 'claimed')]);
  });

  test('counts defeated (claimed) and missed (expired) separately', () => {
    const docs = [
      entry('2026-07-18', 'claimed'),
      entry('2026-07-11', 'expired'),
      entry('2026-07-04', 'claimed'),
    ];
    const { stats } = computeBossHistory(docs, null, 20);
    expect(stats.defeated).toBe(2);
    expect(stats.missed).toBe(1);
  });

  test('current streak counts consecutive claimed entries from the most recent', () => {
    const docs = [
      entry('2026-07-18', 'claimed'),
      entry('2026-07-11', 'claimed'),
      entry('2026-07-04', 'expired'),
      entry('2026-06-27', 'claimed'),
    ];
    const { stats } = computeBossHistory(docs, null, 20);
    expect(stats.currentStreak).toBe(2);
  });

  test('current streak is 0 when the most recent weekend was missed', () => {
    const docs = [entry('2026-07-18', 'expired'), entry('2026-07-11', 'claimed')];
    const { stats } = computeBossHistory(docs, null, 20);
    expect(stats.currentStreak).toBe(0);
  });

  test('respects the limit after excluding the current weekend', () => {
    const docs = [
      entry('2026-07-25', 'active'),
      entry('2026-07-18', 'claimed'),
      entry('2026-07-11', 'claimed'),
      entry('2026-07-04', 'claimed'),
    ];
    const { history } = computeBossHistory(docs, '2026-07-25', 2);
    expect(history).toHaveLength(2);
  });
});
