const BASE_XP = 100;

export function xpRequiredForLevel(level: number): number {
  return Math.floor(BASE_XP * Math.pow(1.5, level));
}
