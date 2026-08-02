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
