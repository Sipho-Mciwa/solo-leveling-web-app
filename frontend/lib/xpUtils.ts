const BASE_XP = 100;

export function xpRequiredForLevel(level: number): number {
  return Math.floor(BASE_XP * Math.pow(1.5, level));
}

/** Mirrors the backend's computeXpGain level-up loop, for client-side reward previews. */
export function projectXpGain(currentXp: number, currentLevel: number, gain: number) {
  let xp = currentXp + gain;
  let level = currentLevel;
  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level++;
  }
  return { xp: Math.max(0, xp), level, leveledUp: level > currentLevel };
}
