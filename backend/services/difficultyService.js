const { db } = require('../config/firebase');

// ─── Constants ────────────────────────────────────────────────────────────────

const MULTIPLIER_MIN = 1.0;
const MULTIPLIER_MAX = 1.5;
const STEP_PER_QUALIFYING_INTERVAL = 0.05; // +5% per 3-day per-quest streak
const QUALIFYING_INTERVAL_DAYS = 3;
const STREAK_LOOKBACK_DAYS = 60; // bounds the Firestore query in calculatePerQuestStreaks

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
 * Calculate the difficulty multiplier from a per-quest consecutive-day streak.
 *
 * Formula:
 *   multiplier = 1 + floor(streak / 3) * 0.05
 *   clamped to [MULTIPLIER_MIN, MULTIPLIER_MAX]
 *
 * A streak of 0-2 stays at base (1.0x) — no single-day spikes. Reaching the
 * 1.5x cap requires a 30-day unbroken streak.
 */
function calculateDifficultyMultiplier(streak) {
  const multiplier = 1 + Math.floor(streak / QUALIFYING_INTERVAL_DAYS) * STEP_PER_QUALIFYING_INTERVAL;
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
