import { DailyQuest, UserProfile } from './api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'none' | 'low' | 'medium' | 'high';

export interface UrgencyStatus {
  level: UrgencyLevel;
  hoursLeft: number;
  minutesLeft: number;
  completedCount: number;
  remainingCount: number;
  totalCount: number;
}

export interface RiskStatus {
  streakAtRisk: boolean;
  rankAtRisk: boolean;
}

export interface RewardResult {
  show: boolean;
  xp: number;
  label: string;
  message: string;
}

// ─── Message banks (Solo Leveling flavour) ─────────────────────────────────────

const BONUS_REWARDS = [
  { label: 'CRITICAL HIT',  message: 'Exceptional output detected.'         },
  { label: 'COMBO BONUS',   message: 'Consecutive effort amplifies growth.' },
  { label: 'SHADOW POWER',  message: 'The shadows recognise your will.'     },
  { label: 'ELITE FOCUS',   message: 'You are leveling faster than most.'   },
];

// ─── Pure functions ────────────────────────────────────────────────────────────

/**
 * Deterministic message based on quest completion state.
 * No randomness — stable across re-renders.
 */
export function generateDynamicMessage(quests: DailyQuest[]): string {
  const total     = quests.length;
  const completed = quests.filter((q) => q.completed).length;
  const remaining = total - completed;

  if (total === 0)                            return '';
  if (remaining === 0)                        return 'All quests complete. The system is satisfied.';
  if (remaining === 1)                        return 'One quest remains. Finish what you started.';
  if (completed >= Math.ceil(total * 0.75))   return 'Almost there. Do not stop now.';
  if (completed === 0)                        return 'The path to S-Rank begins with the first step.';
  return 'Each completed quest brings you closer.';
}

/**
 * Compute time-based urgency level + progress stats.
 * Pass `now` as a parameter so callers can control the clock (e.g. via interval).
 */
export function getUrgencyStatus(quests: DailyQuest[], now: Date = new Date()): UrgencyStatus {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msLeft      = midnight.getTime() - now.getTime();
  const hoursLeft   = msLeft / 3_600_000;
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);

  const completedCount = quests.filter((q) => q.completed).length;
  const remainingCount = quests.length - completedCount;
  const totalCount     = quests.length;

  let level: UrgencyLevel = 'none';
  if (remainingCount > 0) {
    if (hoursLeft <= 2)      level = 'high';
    else if (hoursLeft <= 6) level = 'medium';
    else                     level = 'low';
  }

  return { level, hoursLeft, minutesLeft, completedCount, remainingCount, totalCount };
}

/**
 * Check if the user's streak or rank is at risk.
 * Streak is at risk when it's non-zero and the user hasn't logged today.
 * Rank is at risk when the score is within 8 points of dropping a tier.
 */
export function getRiskStatus(profile: UserProfile): RiskStatus {
  const today        = new Date().toISOString().split('T')[0];
  const hasLoggedToday = profile.lastActiveDate === today;
  const streakAtRisk = (profile.streakCount ?? 0) > 0 && !hasLoggedToday;

  const RANK_MINIMUMS: Partial<Record<string, number>> = { S: 80, A: 50, B: 30, C: 15, D: 6 };
  const score      = (profile.level ?? 1) * 2 + Math.min(profile.streakCount ?? 0, 60);
  const currentMin = RANK_MINIMUMS[profile.rank ?? 'E'] ?? 0;
  const rankAtRisk = currentMin > 0 && score < currentMin + 8;

  return { streakAtRisk, rankAtRisk };
}

/**
 * Called after a quest completes. 35% chance of triggering a bonus reward display.
 * Visual only — the dopamine hit comes from the surprise, not fabricated XP.
 */
export function triggerRandomReward(xpEarned: number): RewardResult {
  if (Math.random() >= 0.35) {
    return { show: false, xp: xpEarned, label: '', message: '' };
  }
  const pick   = BONUS_REWARDS[Math.floor(Math.random() * BONUS_REWARDS.length)];
  return { show: true, xp: xpEarned, label: pick.label, message: pick.message };
}

/** Format time-left string. */
export function formatTimeLeft(hoursLeft: number, minutesLeft: number): string {
  if (hoursLeft >= 1) return `${Math.floor(hoursLeft)}h ${minutesLeft}m left`;
  if (minutesLeft > 0) return `${minutesLeft}m left`;
  return 'Less than a minute';
}
