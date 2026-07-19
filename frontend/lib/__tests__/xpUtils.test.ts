import { describe, test, expect } from 'vitest';
import { xpRequiredForLevel } from '../xpUtils';

describe('xpRequiredForLevel', () => {
  test('matches the backend formula (BASE_XP * 1.5^level, floored)', () => {
    expect(xpRequiredForLevel(1)).toBe(Math.floor(100 * 1.5));
    expect(xpRequiredForLevel(5)).toBe(Math.floor(100 * Math.pow(1.5, 5)));
  });

  test('increases monotonically with level', () => {
    for (let level = 1; level < 20; level++) {
      expect(xpRequiredForLevel(level + 1)).toBeGreaterThan(xpRequiredForLevel(level));
    }
  });
});
