const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { updateStreak } = require('./streakService');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Default quests seeded for every user
const DEFAULT_QUESTS = [
  { title: 'Push-ups', type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Sit-ups',  type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Squats',   type: 'fitness', targetValue: 20, xpReward: 30, isCustom: false },
  { title: 'Running',  type: 'fitness', targetValue: 1,  xpReward: 50, isCustom: false },
];

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

  const batch = db.batch();
  for (const qDoc of questDocs) {
    const ref = db.collection('dailyQuests').doc();
    batch.set(ref, {
      userId,
      questId: qDoc.id,
      date,
      currentValue: 0,
      completed: false,
    });
  }
  await batch.commit();

  return { generated: true, message: 'Daily quests created' };
}

async function seedDefaultQuests(_userId) {
  const batch = db.batch();
  const refs = [];

  for (const q of DEFAULT_QUESTS) {
    const ref = db.collection('quests').doc();
    batch.set(ref, { ...q, userId: null }); // shared global quests
    refs.push(ref);
  }

  await batch.commit();

  // Return as mock docs for immediate use
  return refs.map((ref, i) => ({ id: ref.id, data: () => DEFAULT_QUESTS[i] }));
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

  const clampedValue = Math.min(newValue, quest.targetValue);
  const isComplete = clampedValue >= quest.targetValue;

  await dqRef.update({
    currentValue: clampedValue,
    completed: isComplete,
  });

  let xpResult = null;
  let streakResult = null;

  if (isComplete) {
    xpResult = await addXp(userId, quest.xpReward);
    streakResult = await updateStreak(userId);
  }

  return {
    completed: isComplete,
    currentValue: clampedValue,
    xp: xpResult,
    streak: streakResult,
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

  const quests = questSnaps
    .filter((snap) => snap.exists)
    .map((snap) => ({
      questId: snap.id,
      title: snap.data().title,
      history: byQuestId[snap.id],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { quests };
}

module.exports = { getTodayQuests, generateDailyQuests, updateQuestProgress, getQuestHistory };
