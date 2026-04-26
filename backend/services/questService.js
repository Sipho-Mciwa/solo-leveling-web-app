const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { updateStreak } = require('./streakService');
const { applyDifficultyScaling } = require('./difficultyService');
const { updateUserRank } = require('./rankService');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Default quests seeded for every user
const DEFAULT_QUESTS = [
  { title: 'Push-ups', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Sit-ups',  type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Squats',   type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Running',  type: 'fitness', targetValue: 5,  xpReward: 50, isCustom: false },
];

// Max overperformance bonus as a fraction of the base XP reward (50% cap)
const OVERPERFORMANCE_CAP = 0.5;

/**
 * Returns today's dailyQuests for a user, merged with their quest template data.
 */
async function getTodayQuests(userId) {
  const date = todayStr();
  const snapshot = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();

  if (snapshot.empty) return [];

  const quests = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const dq = { id: doc.id, ...doc.data() };
      const questSnap = await db.collection('quests').doc(dq.questId).get();
      const questData = questSnap.exists ? questSnap.data() : {};
      return { ...dq, ...questData, id: doc.id };
    })
  );

  return quests;
}

/**
 * Generates today's dailyQuests for a user if they don't exist yet.
 * Called on login.
 */
async function generateDailyQuests(userId) {
  const date = todayStr();

  // Check if already generated
  const existing = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { generated: false, message: 'Already generated for today' };
  }

  // Load user's quest templates (defaults + custom)
  const questsSnap = await db
    .collection('quests')
    .where('userId', 'in', [userId, null])
    .get();

  // If no quests exist for user, seed defaults first
  let questDocs = questsSnap.docs;
  if (questDocs.length === 0) {
    questDocs = await seedDefaultQuests(userId);
  }

  // Fetch user profile for streak context
  const userSnap = await db.collection('users').doc(userId).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  // Compute difficulty scaling for all quests in one batched call
  const scalingResults = await applyDifficultyScaling(
    userId,
    questDocs,
    userData.streakCount || 0,
    userData.lastActiveDate || null
  );
  const scalingByQuestId = Object.fromEntries(scalingResults.map((s) => [s.questId, s]));

  const batch = db.batch();
  for (const qDoc of questDocs) {
    const scaling = scalingByQuestId[qDoc.id];
    const ref = db.collection('dailyQuests').doc();
    batch.set(ref, {
      userId,
      questId: qDoc.id,
      date,
      currentValue: 0,
      completed: false,
      baseTarget: scaling.baseTarget,
      currentTarget: scaling.currentTarget,
      difficultyMultiplier: scaling.difficultyMultiplier,
    });
  }
  await batch.commit();

  return { generated: true, message: 'Daily quests created' };
}

async function seedDefaultQuests(_userId) {
  const batch = db.batch();

  for (const q of DEFAULT_QUESTS) {
    // Use a deterministic ID so re-seeding is idempotent (no duplicates)
    const docId = `default_${q.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const ref = db.collection('quests').doc(docId);
    batch.set(ref, { ...q, userId: null }); // shared global quests
  }

  await batch.commit();

  // Return as mock docs for immediate use
  return DEFAULT_QUESTS.map((q) => {
    const docId = `default_${q.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    return { id: docId, data: () => q };
  });
}

/**
 * Update progress on a daily quest. Awards XP + updates streak on completion.
 */
async function updateQuestProgress(dailyQuestId, userId, newValue) {
  const dqRef = db.collection('dailyQuests').doc(dailyQuestId);
  const dqSnap = await dqRef.get();

  if (!dqSnap.exists) throw new Error('Daily quest not found');

  const dq = dqSnap.data();
  if (dq.userId !== userId) throw new Error('Unauthorized');
  if (dq.completed) return { alreadyCompleted: true };

  // Fetch the quest template for targetValue + xpReward
  const questSnap = await db.collection('quests').doc(dq.questId).get();
  if (!questSnap.exists) throw new Error('Quest template not found');
  const quest = questSnap.data();

  // Use scaled target if present (new docs), fall back to template targetValue (old docs)
  const target = dq.currentTarget ?? quest.targetValue;
  const isComplete = newValue >= target;

  // Delta logged this submission — used to auto-update the weekly boss
  const delta = newValue - (dq.currentValue || 0);

  await dqRef.update({
    currentValue: newValue,
    completed: isComplete,
  });


  let xpResult = null;
  let streakResult = null;
  let rankResult = null;
  let bonusXp = null;

  if (isComplete) {
    xpResult = await addXp(userId, quest.xpReward);
    streakResult = await updateStreak(userId);
    rankResult = await updateUserRank(userId);

    // Overperformance bonus: up to 50% extra XP for exceeding the target
    if (newValue > target) {
      const overRatio = Math.min((newValue - target) / target, OVERPERFORMANCE_CAP);
      const bonusAmount = Math.floor(quest.xpReward * overRatio);
      if (bonusAmount > 0) {
        bonusXp = bonusAmount;
        await addXp(userId, bonusAmount);
      }
    }
  }

  return {
    completed:    isComplete,
    currentValue: newValue,
    xp:           xpResult,
    streak:       streakResult,
    rank:         rankResult,
    bonusXp,
  };
}

/**
 * Returns monthly quest history grouped by quest, with per-day completion data.
 * Requires a Firestore composite index on: dailyQuests (userId ASC, date ASC).
 * If the query fails with "index required", use the URL in the error to create it.
 */
async function getQuestHistory(userId, month) {
  // month = "YYYY-MM"
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const snapshot = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  if (snapshot.empty) return { quests: [] };

  // Group by questId → { [date]: { completed, currentValue } }
  const byQuestId = {};
  for (const doc of snapshot.docs) {
    const dq = doc.data();
    if (!byQuestId[dq.questId]) byQuestId[dq.questId] = {};
    byQuestId[dq.questId][dq.date] = {
      completed: dq.completed,
      currentValue: dq.currentValue,
    };
  }

  // Fetch quest titles in parallel
  const questIds = Object.keys(byQuestId);
  const questSnaps = await Promise.all(
    questIds.map((id) => db.collection('quests').doc(id).get())
  );

  const rawQuests = questSnaps
    .filter((snap) => snap.exists)
    .map((snap) => ({
      questId: snap.id,
      title: snap.data().title,
      history: byQuestId[snap.id],
    }));

  // Deduplicate by title — if the same quest was seeded multiple times (duplicate
  // templates in Firestore), merge their day-by-day history into a single row,
  // preferring completed entries when the same date appears in more than one copy.
  const byTitle = {};
  for (const q of rawQuests) {
    if (!byTitle[q.title]) {
      byTitle[q.title] = q;
    } else {
      for (const [date, entry] of Object.entries(q.history)) {
        const existing = byTitle[q.title].history[date];
        if (!existing || entry.completed) {
          byTitle[q.title].history[date] = entry;
        }
      }
    }
  }

  const quests = Object.values(byTitle).sort((a, b) => a.title.localeCompare(b.title));

  return { quests };
}

module.exports = { getTodayQuests, generateDailyQuests, updateQuestProgress, getQuestHistory };
