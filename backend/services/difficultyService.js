const { db } = require('../config/firebase');

// ─── Constants ────────────────────────────────────────────────────────────────

const MULTIPLIER_MIN = 0.7;
const MULTIPLIER_MAX = 1.5;
const MOMENTUM_BONUS_PER_3_DAYS = 0.05; // +5% per 3-day streak increment
const MOMENTUM_BONUS_CAP = 0.15;         // max +15% from momentum (streak 9+)
const NEUTRAL_PERFORMANCE = 0.5;         // used when no history exists

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(dateStrA, dateStrB) {
  const msPerDay = 86400000;
  return Math.round(
    (new Date(dateStrB + 'T00:00:00') - new Date(dateStrA + 'T00:00:00')) / msPerDay
  );
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Calculate per-quest performance scores using a single Firestore query.
 * Returns a map of { questId → completionRate (0.0–1.0) }.
 * Defaults to NEUTRAL_PERFORMANCE (0.5) for quests with no history.
 */
async function calculatePerformance(userId, questIds) {
  const startDate = nDaysAgo(7);
  const endDate = nDaysAgo(1); // exclude today (not yet completed)

  const snapshot = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  // Tally completions per questId
  const tally = {};
  for (const doc of snapshot.docs) {
    const dq = doc.data();
    if (!questIds.includes(dq.questId)) continue;
    if (!tally[dq.questId]) tally[dq.questId] = { total: 0, completed: 0 };
    tally[dq.questId].total++;
    if (dq.completed) tally[dq.questId].completed++;
  }

  // Return completion rate per quest (default to neutral if no data)
  const result = {};
  for (const id of questIds) {
    const t = tally[id];
    result[id] = t && t.total > 0 ? t.completed / t.total : NEUTRAL_PERFORMANCE;
  }
  return result;
}

/**
 * Calculate the difficulty multiplier from performance + streak context.
 *
 * Formula:
 *   base = 1 + (performanceScore - 0.5)   → range [0.5, 1.5]
 *   + momentum bonus (every 3-day streak = +5%, capped at +15%)
 *   → clamp to [MULTIPLIER_MIN, MULTIPLIER_MAX]
 *
 * Failure penalty: if missedDays >= 2, collapse to minimum and skip momentum.
 */
function calculateDifficultyMultiplier(performanceScore, streakCount, missedDays) {
  // Hard reset on failure
  if (missedDays >= 2) return MULTIPLIER_MIN;

  let multiplier = 1 + (performanceScore - 0.5);

  // Momentum bonus
  const momentumBonus = Math.min(
    Math.floor(streakCount / 3) * MOMENTUM_BONUS_PER_3_DAYS,
    MOMENTUM_BONUS_CAP
  );
  multiplier += momentumBonus;

  return Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, multiplier));
}

/**
 * Scale a base target by a multiplier.
 * Always returns a whole number ≥ 1.
 */
function generateScaledTarget(baseTarget, multiplier) {
  return Math.max(1, Math.round(baseTarget * multiplier));
}

/**
 * Main entry point: compute scaled targets for all quests in one call.
 *
 * questDocs — Firestore doc references (real or mock), each with .id and .data()
 * Returns array of { questId, baseTarget, currentTarget, difficultyMultiplier }
 */
async function applyDifficultyScaling(userId, questDocs, streakCount, lastActiveDate) {
  const today = todayStr();

  // How many days has the user been inactive?
  const missedDays = lastActiveDate
    ? Math.max(0, daysBetween(lastActiveDate, today) - 1)
    : 0;

  const questIds = questDocs.map((d) => d.id);
  const performanceMap = await calculatePerformance(userId, questIds);

  return questDocs.map((qDoc) => {
    const data = qDoc.data();
    const baseTarget = data.targetValue;
    const performanceScore = performanceMap[qDoc.id] ?? NEUTRAL_PERFORMANCE;
    const multiplier = calculateDifficultyMultiplier(performanceScore, streakCount, missedDays);
    const currentTarget = generateScaledTarget(baseTarget, multiplier);

    return {
      questId: qDoc.id,
      baseTarget,
      currentTarget,
      difficultyMultiplier: Math.round(multiplier * 100) / 100,
    };
  });
}

module.exports = {
  calculatePerformance,
  calculateDifficultyMultiplier,
  generateScaledTarget,
  applyDifficultyScaling,
};
