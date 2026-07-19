jest.mock('../config/firebase', () => ({ db: {}, auth: {} }));

const { computePromotion } = require('../services/rankService');

const ZERO_STATS = { PHY: 0, DISCIPLINE: 0, STAMINA: 0, INTELLECT: 0 };

describe('computePromotion', () => {
  test('stays at current rank if requirements are not met', () => {
    const user = { rank: 'E', level: 1, streakCount: 0 };
    const { updates, result } = computePromotion(user, ZERO_STATS);
    expect(result.rank).toBe('E');
    expect(result.promoted).toBe(false);
    expect(updates.rank).toBe('E');
  });

  test('promotes exactly one rank when only the next tier is met', () => {
    const user = { rank: 'E', level: 5, streakCount: 3 };
    const { result } = computePromotion(user, ZERO_STATS);
    expect(result.rank).toBe('D');
    expect(result.promoted).toBe(true);
  });

  test('promotes through multiple ranks in one call when all criteria chain', () => {
    const user = { rank: 'E', level: 20, streakCount: 14 };
    const stats = { PHY: 40, DISCIPLINE: 60, STAMINA: 0, INTELLECT: 0 };
    const { result } = computePromotion(user, stats);
    expect(result.rank).toBe('B');
  });

  test('does not demote if a stat regresses below current rank requirements', () => {
    const user = { rank: 'C', level: 1, streakCount: 0 };
    const { result } = computePromotion(user, ZERO_STATS);
    expect(result.rank).toBe('C');
    expect(result.promoted).toBe(false);
  });

  test('awards the shadow_monarch title on reaching S-Rank', () => {
    const user = { rank: 'A', level: 50, streakCount: 30, titles: ['E Rank Hunter'] };
    const stats = { PHY: 75, DISCIPLINE: 80, STAMINA: 60, INTELLECT: 50 };
    const { updates, result } = computePromotion(user, stats);
    expect(result.rank).toBe('S');
    expect(updates.titles).toContain('shadow_monarch');
  });

  test('does not duplicate shadow_monarch title if already earned', () => {
    const user = { rank: 'S', level: 50, streakCount: 30, titles: ['shadow_monarch'], activeTitle: 'shadow_monarch' };
    const stats = { PHY: 75, DISCIPLINE: 80, STAMINA: 60, INTELLECT: 50 };
    const { updates } = computePromotion(user, stats);
    expect(updates.titles).toBeUndefined();
  });

  test('sets activeTitle to the first earned title if none is active', () => {
    const user = { rank: 'E', level: 1, streakCount: 0, titles: ['some_title'] };
    const { updates } = computePromotion(user, ZERO_STATS);
    expect(updates.activeTitle).toBe('some_title');
  });
});
