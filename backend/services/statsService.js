const { db } = require('../config/firebase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const WINDOW = 14; // days of history to consider
const DEFAULT_LOW = 10; // floor when no data exists (not zero, not misleading)

/**
 * Clamp a 0–1 ratio to a 10–100 integer score.
 * Returns DEFAULT_LOW when ratio is null/NaN/undefined.
 */
function toScore(ratio) {
  if (ratio == null || isNaN(ratio)) return DEFAULT_LOW;
  return Math.max(DEFAULT_LOW, Math.round(ratio * 100));
}

/**
 * Fill rate for a single dailyQuest entry: how much of the target was done.
 * Clamped to [0, 1].
 */
function fillRate(entry) {
  const target = entry.currentTarget ?? entry.baseTarget ?? entry.targetValue ?? 1;
  if (target <= 0) return 0;
  return Math.min(entry.currentValue / target, 1);
}

// ─── Individual stat calculators (operate on pre-fetched data) ────────────────

/**
 * PHY — Physical strength.
 * Average fill rate of push-up and squat entries.
 */
function calculatePHY(questDocs) {
  const entries = questDocs.filter(
    (q) => q.questId === 'default_push_ups' || q.questId === 'default_squats'
  );
  if (entries.length === 0) return DEFAULT_LOW;
  const avg = entries.reduce((s, e) => s + fillRate(e), 0) / entries.length;
  return toScore(avg);
}

/**
 * SPD — Running consistency.
 * Fraction of running entries that were marked complete.
 */
function calculateSPD(questDocs) {
  const entries = questDocs.filter((q) => q.questId === 'default_running');
  if (entries.length === 0) return DEFAULT_LOW;
  const completed = entries.filter((e) => e.completed).length;
  return toScore(completed / entries.length);
}

/**
 * STAMINA — Endurance / distance fill.
 * Average fill rate of running entries (how much of the target distance was covered).
 */
function calculateSTAMINA(questDocs) {
  const entries = questDocs.filter((q) => q.questId === 'default_running');
  if (entries.length === 0) return DEFAULT_LOW;
  const avg = entries.reduce((s, e) => s + fillRate(e), 0) / entries.length;
  return toScore(avg);
}

/**
 * DISCIPLINE — Daily challenge completion rate.
 * Average fraction of challenges completed per day.
 */
function calculateDISCIPLINE(challengeDocs) {
  if (challengeDocs.length === 0) return DEFAULT_LOW;
  const avg =
    challengeDocs.reduce((s, doc) => {
      const challenges = doc.challenges || [];
      if (challenges.length === 0) return s;
      const done = challenges.filter((c) => c.completed).length;
      return s + done / challenges.length;
    }, 0) / challengeDocs.length;
  return toScore(avg);
}

/**
 * INTELLECT — Reading consistency.
 * Fraction of days where the "read_10_pages" challenge was completed.
 */
function calculateINTELLECT(challengeDocs) {
  let days = 0;
  let completed = 0;
  for (const doc of challengeDocs) {
    const reading = (doc.challenges || []).find((c) => c.key === 'read_10_pages');
    if (reading) {
      days++;
      if (reading.completed) completed++;
    }
  }
  if (days === 0) return DEFAULT_LOW;
  return toScore(completed / days);
}

// ─── Public API ───────────────────────────────────────────────────────────────

const STAT_KEYS = ['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT'];

/**
 * Returns all five hunter stats (0–100) plus week-over-week delta.
 * Uses a single 14-day Firestore read, split in memory for the delta.
 */
async function getUserStats(userId) {
  const startDate = nDaysAgo(WINDOW - 1); // 13 days ago (full window)
  const midDate   = nDaysAgo(6);          // 6 days ago  (last-7 / prev-7 boundary)
  const endDate   = todayStr();

  // Two parallel Firestore reads: quests + challenges
  const [questsSnap, challengesSnap] = await Promise.all([
    db
      .collection('dailyQuests')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get(),
    db
      .collection('dailyChallenges')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get(),
  ]);

  const questDocs      = questsSnap.docs.map((d) => d.data());
  const challengeDocs  = challengesSnap.docs.map((d) => d.data());

  // Split into last-7 vs prev-7 for delta computation (no extra reads)
  const recentQuests     = questDocs.filter((q) => q.date >= midDate);
  const prevQuests       = questDocs.filter((q) => q.date <  midDate);
  const recentChallenges = challengeDocs.filter((c) => c.date >= midDate);
  const prevChallenges   = challengeDocs.filter((c) => c.date <  midDate);

  // Main stats: full 14-day window
  const current = {
    PHY:        calculatePHY(questDocs),
    SPD:        calculateSPD(questDocs),
    STAMINA:    calculateSTAMINA(questDocs),
    DISCIPLINE: calculateDISCIPLINE(challengeDocs),
    INTELLECT:  calculateINTELLECT(challengeDocs),
  };

  // Delta: last-7 minus prev-7
  const recent = {
    PHY:        calculatePHY(recentQuests),
    SPD:        calculateSPD(recentQuests),
    STAMINA:    calculateSTAMINA(recentQuests),
    DISCIPLINE: calculateDISCIPLINE(recentChallenges),
    INTELLECT:  calculateINTELLECT(recentChallenges),
  };
  const prev = {
    PHY:        calculatePHY(prevQuests),
    SPD:        calculateSPD(prevQuests),
    STAMINA:    calculateSTAMINA(prevQuests),
    DISCIPLINE: calculateDISCIPLINE(prevChallenges),
    INTELLECT:  calculateINTELLECT(prevChallenges),
  };

  const delta = {};
  for (const key of STAT_KEYS) {
    delta[key] = recent[key] - prev[key];
  }

  return { ...current, delta };
}

module.exports = {
  getUserStats,
  calculatePHY,
  calculateSPD,
  calculateSTAMINA,
  calculateDISCIPLINE,
  calculateINTELLECT,
};
