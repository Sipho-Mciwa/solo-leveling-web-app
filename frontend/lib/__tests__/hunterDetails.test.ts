import { describe, test, expect } from 'vitest';
import { getHunterDetails } from '../hunterDetails';
import { UserProfile, HunterStats } from '../api';

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

function stats(overrides: Partial<Omit<HunterStats, 'delta'>> = {}): HunterStats {
  return {
    PHY: 0,
    SPD: 0,
    STAMINA: 0,
    DISCIPLINE: 0,
    INTELLECT: 0,
    delta: { PHY: 0, SPD: 0, STAMINA: 0, DISCIPLINE: 0, INTELLECT: 0 },
    ...overrides,
  };
}

describe('getHunterDetails', () => {
  test('is deterministic for the same user id', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    const b = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(a).toEqual(b);
  });

  test('differs across user ids', () => {
    const a = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    const b = getHunterDetails('user-2', 'Sipho Mciwa', baseProfile(), stats());
    // Not every field is guaranteed to differ, but the whole placeholder set
    // being identical between two different users would indicate the seed
    // isn't actually doing anything.
    expect(a).not.toEqual(b);
  });

  test('splits the display name into first/last', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.firstName).toBe('Sipho');
    expect(details.lastName).toBe('Mciwa');
  });

  test('falls back to "Hunter" with no display name', () => {
    const details = getHunterDetails('user-1', null, baseProfile(), stats());
    expect(details.firstName).toBe('Hunter');
    expect(details.lastName).toBe('');
  });

  test('marks placeholder fields as unverified', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.isPlaceholder).toBe(true);
  });

  test('prefers real profile values over placeholders once set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({
      height: '180 cm',
      dateOfBirth: '1999-12-17',
      weight: '75 kg',
      sex: 'Male',
      jobClass: 'Fighter',
    }), stats());
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

    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({ dateOfBirth: iso }), stats());
    expect(details.age).toBe(30);
  });

  test('falls back to a placeholder age when dateOfBirth is not set', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.age).toBeGreaterThanOrEqual(18);
    expect(details.age).toBeLessThanOrEqual(35);
  });

  test('hunter ID is a stable HTR-###### code derived from the user id', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile(), stats());
    expect(details.hunterId).toMatch(/^HTR-\d{6}$/);
  });

  test('prefers a real profile hunterId over the derived placeholder', () => {
    const details = getHunterDetails('user-1', 'Sipho Mciwa', baseProfile({
      hunterId: 'HTR-171299',
    }), stats());
    expect(details.hunterId).toBe('HTR-171299');
    expect(details.isPlaceholder).toBe(false);
  });

  describe('jobClass derivation', () => {
    test('derives Fighter when PHY is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, SPD: 20, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Fighter');
    });

    test('derives Scout when SPD is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 80, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Scout');
    });

    test('derives Tank when STAMINA is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 80, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Tank');
    });

    test('derives Mage when INTELLECT is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 80 }));
      expect(details.jobClass).toBe('Mage');
    });

    test('derives Ranger when DISCIPLINE is the clear leader', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 20, STAMINA: 20, DISCIPLINE: 80, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Ranger');
    });

    test('derives Berserker when PHY and SPD are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, SPD: 80, STAMINA: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Berserker');
    });

    test('derives Juggernaut when PHY and STAMINA are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, STAMINA: 80, SPD: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Juggernaut');
    });

    test('derives Knight when PHY and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, DISCIPLINE: 80, SPD: 20, STAMINA: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Knight');
    });

    test('derives Spellblade when PHY and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 80, INTELLECT: 80, SPD: 20, STAMINA: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Spellblade');
    });

    test('derives Assassin when SPD and STAMINA are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, STAMINA: 80, PHY: 20, DISCIPLINE: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Assassin');
    });

    test('derives Duelist when SPD and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, DISCIPLINE: 80, PHY: 20, STAMINA: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Duelist');
    });

    test('derives Trickster when SPD and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ SPD: 80, INTELLECT: 80, PHY: 20, STAMINA: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Trickster');
    });

    test('derives Sentinel when STAMINA and DISCIPLINE are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ STAMINA: 80, DISCIPLINE: 80, PHY: 20, SPD: 20, INTELLECT: 20 }));
      expect(details.jobClass).toBe('Sentinel');
    });

    test('derives Warden when STAMINA and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ STAMINA: 80, INTELLECT: 80, PHY: 20, SPD: 20, DISCIPLINE: 20 }));
      expect(details.jobClass).toBe('Warden');
    });

    test('derives Sage when DISCIPLINE and INTELLECT are tied at the top', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ DISCIPLINE: 80, INTELLECT: 80, PHY: 20, SPD: 20, STAMINA: 20 }));
      expect(details.jobClass).toBe('Sage');
    });

    test('derives Unclassified when 3+ stats are bunched at the top with a low average', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 20, SPD: 18, STAMINA: 16, DISCIPLINE: 5, INTELLECT: 5 }));
      expect(details.jobClass).toBe('Unclassified');
    });

    test('derives Unclassified for a brand-new account with all stats at 0', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats());
      expect(details.jobClass).toBe('Unclassified');
    });

    test('derives Player when 3+ stats are bunched at the top with a high average', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 99, SPD: 97, STAMINA: 95, DISCIPLINE: 90, INTELLECT: 90 }));
      expect(details.jobClass).toBe('Player');
    });

    test('derives Player at exactly the elite threshold average (boundary is inclusive)', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 85, SPD: 85, STAMINA: 85, DISCIPLINE: 85, INTELLECT: 85 }));
      expect(details.jobClass).toBe('Player');
    });

    test('derives Unclassified just below the elite threshold average (boundary is inclusive, not exclusive)', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 84, SPD: 84, STAMINA: 84, DISCIPLINE: 84, INTELLECT: 84 }));
      expect(details.jobClass).toBe('Unclassified');
    });

    test('derives Player when the top 3 stats are bunched and elite, even with two unrelated low stats', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), stats({ PHY: 90, SPD: 88, STAMINA: 86, DISCIPLINE: 10, INTELLECT: 10 }));
      expect(details.jobClass).toBe('Player');
    });

    test('a manual profile.jobClass override wins over the derived value', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile({ jobClass: 'Mage' }), stats({ PHY: 90, SPD: 10, STAMINA: 10, DISCIPLINE: 10, INTELLECT: 10 }));
      expect(details.jobClass).toBe('Mage');
    });

    test('shows a loading placeholder when stats have not loaded yet', () => {
      const details = getHunterDetails('user-1', 'Sipho', baseProfile(), null);
      expect(details.jobClass).toBe('—');
    });
  });
});
