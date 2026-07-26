const { db } = require('../config/firebase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Quest templates don't have a dedicated "type" for run vs reps (both are
// just `type: 'fitness'`), so distinguish by title — same heuristic already
// used on the frontend (NextObjectiveCard) for units.
function isRunTitle(title) {
  return (title || '').toLowerCase().includes('run');
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * All-time personal-best records for a user:
 *  - longestStreak: peak day-streak on record (from userMemory, refreshed by
 *    the AI memory job — null if that job hasn't run for this user yet).
 *  - mostRepsInADay: the single day with the highest combined reps across all
 *    non-running quests (push-ups + sit-ups + squats etc., summed per day).
 *  - longestRun: the single largest logged run distance (km).
 */
async function getHunterRecords(userId) {
  const [questsSnap, dqSnap, memorySnap] = await Promise.all([
    db.collection('quests').get(),
    db.collection('dailyQuests').where('userId', '==', userId).get(),
    db.collection('userMemory').doc(userId).get(),
  ]);

  const titleByQuestId = new Map();
  for (const doc of questsSnap.docs) titleByQuestId.set(doc.id, doc.data().title || '');

  const repsByDate = new Map(); // date -> summed reps that day
  let longestRun = 0;
  let longestRunDate = null;

  for (const doc of dqSnap.docs) {
    const d = doc.data();
    const value = d.currentValue || 0;
    if (value <= 0) continue;

    const title = titleByQuestId.get(d.questId) || '';

    if (isRunTitle(title)) {
      if (value > longestRun) {
        longestRun = value;
        longestRunDate = d.date;
      }
    } else {
      repsByDate.set(d.date, (repsByDate.get(d.date) || 0) + value);
    }
  }

  let mostReps = 0;
  let mostRepsDate = null;
  for (const [date, total] of repsByDate) {
    if (total > mostReps) {
      mostReps = total;
      mostRepsDate = date;
    }
  }

  const memory = memorySnap.exists ? memorySnap.data() : null;
  const longestStreak = memory?.streakHistory?.longestStreak ?? null;

  return {
    longestStreak,
    mostRepsInADay: mostReps > 0 ? { value: mostReps, date: mostRepsDate } : null,
    longestRun: longestRun > 0 ? { value: longestRun, date: longestRunDate } : null,
  };
}

module.exports = { getHunterRecords };
