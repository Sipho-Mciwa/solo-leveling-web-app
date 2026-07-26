import { UserProfile } from './api';

// Placeholder hunter character-sheet values — shown until real values are
// set on the user profile (those fields are fixed/backend-set, not user-
// editable from the UI). Deterministically seeded from the user's id so the
// same "random" placeholder shows every time instead of reshuffling on
// every reload.

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const JOB_CLASSES = ['Fighter', 'Assassin', 'Mage', 'Tank', 'Ranger', 'Healer'];

function seedFromString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// mulberry32 — small, fast, deterministic PRNG from a numeric seed.
function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function inRange(rand: () => number, min: number, max: number): number {
  return Math.round(min + rand() * (max - min));
}

export interface HunterDetails {
  firstName: string;
  lastName: string;
  height: string;
  age: number;
  weight: string;
  bloodType: string;
  jobClass: string;
  hunterId: string;
  /** True if every field came from the real profile, not a placeholder. */
  isPlaceholder: boolean;
}

function splitDisplayName(displayName?: string | null): [string, string] {
  if (!displayName) return ['Hunter', ''];
  const parts = displayName.trim().split(/\s+/);
  return [parts[0], parts.slice(1).join(' ')];
}

export function getHunterDetails(
  userId: string,
  displayName: string | null | undefined,
  profile: UserProfile,
): HunterDetails {
  const rand = mulberry32(seedFromString(userId));
  const [fallbackFirst, fallbackLast] = splitDisplayName(displayName);

  const hasRealDetails = Boolean(
    profile.height || profile.age || profile.weight || profile.bloodType || profile.jobClass
  );

  return {
    firstName: profile.firstName ?? fallbackFirst,
    lastName:  profile.lastName  ?? fallbackLast,
    height:    profile.height    ?? `${inRange(rand, 160, 195)} cm`,
    age:       profile.age       ?? inRange(rand, 18, 35),
    weight:    profile.weight    ?? `${inRange(rand, 55, 95)} kg`,
    bloodType: profile.bloodType ?? pick(rand, BLOOD_TYPES),
    jobClass:  profile.jobClass  ?? pick(rand, JOB_CLASSES),
    hunterId:  `HTR-${(seedFromString(userId) % 1_000_000).toString().padStart(6, '0')}`,
    isPlaceholder: !hasRealDetails,
  };
}
