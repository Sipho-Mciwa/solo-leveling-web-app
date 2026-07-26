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
      age: 30,
      weight: '75 kg',
      bloodType: 'O+',
      jobClass: 'Fighter',
    }));
    expect(details.height).toBe('180 cm');
    expect(details.age).toBe(30);
    expect(details.weight).toBe('75 kg');
    expect(details.bloodType).toBe('O+');
    expect(details.jobClass).toBe('Fighter');
    expect(details.isPlaceholder).toBe(false);
  });

  test('hunter ID is a stable HTR-###### code derived from the user id', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile());
    expect(details.hunterId).toMatch(/^HTR-\d{6}$/);
  });
});
