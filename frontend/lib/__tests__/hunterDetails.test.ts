import { describe, test, expect } from 'vitest';
import { getHunterDetails } from '../hunterDetails';
import { UserProfile } from '../api';

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'sipho@example.com',
    xp: 0,
    level: 1,
    streakCount: 0,
    lastActiveDate: null,
    rank: 'E',
    titles: [],
    activeTitle: null,
    ...overrides,
  };
}

describe('getHunterDetails', () => {
  test('is deterministic for the same user id', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    const b = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(a).toEqual(b);
  });

  test('differs across user ids', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    const b = getHunterDetails('user-2', 'Sipho Mciwa', baseProfile());
    // Not every field is guaranteed to differ, but the whole placeholder set
    // being identical between two different users would indicate the seed
    // isn't actually doing anything.
    expect(a).not.toEqual(b);
  });

  test('splits the display name into first/last', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(details.firstName).toBe('Sipho');
    expect(details.lastName).toBe('Mciwa');
  });

  test('falls back to "Hunter" with no display name', () => {
    const details = getHunterDetails('user-1', null, baseProfile());
    expect(details.firstName).toBe('Hunter');
    expect(details.lastName).toBe('');
  });

  test('marks placeholder fields as unverified', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(details.isPlaceholder).toBe(true);
  });

  test('prefers real profile values over placeholders once set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({
      height: '180 cm',
      dateOfBirth: '1999-12-17',
      weight: '75 kg',
      sex: 'Male',
      jobClass: 'Fighter',
    }));
    expect(details.height).toBe('180 cm');
    expect(details.weight).toBe('75 kg');
    expect(details.sex).toBe('Male');
    expect(details.jobClass).toBe('Fighter');
    expect(details.isPlaceholder).toBe(false);
  });

  test('computes age from dateOfBirth as of today, not a stored number', () => {
    // A birthday that lands exactly today, N years ago — age is
    // deterministic regardless of when this test runs.
    const now = new Date();
    const dob = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate());
    const iso = dob.toISOString().slice(0, 10);

    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({ dateOfBirth: iso }));
    expect(details.age).toBe(30);
  });

  test('falls back to a placeholder age when dateOfBirth is not set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(details.age).toBeGreaterThanOrEqual(18);
    expect(details.age).toBeLessThanOrEqual(35);
  });

  test('hunter ID is a stable HTR-###### code derived from the user id', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(details.hunterId).toMatch(/^HTR-\d{6}$/);
  });
});
