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
 * Count each quest's consecutive completed-day streak, walking backward
 * from yesterday and stopping at the first day with no doc or
 * `completed !== true`. Bounded to STREAK_LOOKBACK_DAYS to keep the
 * Firestore query finite.
 *
 * Returns a map of { questId → streak (0 if no qualifying history) }.
 */
async function calculatePerQuestStreaks(userId, questIds) {
  const startDate = nDaysAgo(STREAK_LOOKBACK_DAYS);
  const endDate = nDaysAgo(1); // exclude today (not yet completed)

  const snapshot = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  const completedByDateByQuest = {};
  for (const doc of snapshot.docs) {
    const dq = doc.data();
    if (!questIds.includes(dq.questId)) continue;
    if (!completedByDateByQuest[dq.questId]) completedByDateByQuest[dq.questId] = new Map();
    completedByDateByQuest[dq.questId].set(dq.date, dq.completed === true);
  }

  const result = {};
  for (const id of questIds) {
    const completedByDate = completedByDateByQuest[id] || new Map();
    let streak = 0;
    for (let n = 1; n <= STREAK_LOOKBACK_DAYS; n++) {
      if (completedByDate.get(nDaysAgo(n)) === true) {
        streak++;
      } else {
        break;
      }
    }
    result[id] = streak;
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
async function applyDifficultyScaling(userId, questDocs) {
  const questIds = questDocs.map((d) => d.id);
  const streaks = await calculatePerQuestStreaks(userId, questIds);

  return questDocs.map((qDoc) => {
    const data = qDoc.data();
    const baseTarget = data.targetValue;
    const streak = streaks[qDoc.id] ?? 0;
    const multiplier = calculateDifficultyMultiplier(streak);
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
  calculatePerQuestStreaks,
  calculateDifficultyMultiplier,
  generateScaledTarget,
  applyDifficultyScaling,
};
