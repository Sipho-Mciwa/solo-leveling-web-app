import { describe, test, expect } from 'vitest';
import { resolveAchievementName, ACHIEVEMENT_MAP } from '../achievementMap';

describe('resolveAchievementName', () => {
  test('resolves a known title id to its display name', () => {
    expect(resolveAchievementName('shadow_monarch')).toBe('Shadow Monarch');
  });

  test('falls back to the raw key for an unknown id', () => {
    expect(resolveAchievementName('some_future_title')).toBe('some_future_title');
  });

  test('every mapped value is a non-empty string', () => {
    for (const name of Object.values(ACHIEVEMENT_MAP)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
