const { db } = require('../config/firebase');
const { computeXpGain } = require('./xpService');
const { computeStreakUpdate } = require('./streakService');
const { applyDifficultyScaling } = require('./difficultyService');
const { computePromotion } = require('./rankService');
const { getUserStats } = require('./statsService');
const { AppError } = require('../utils/AppError');

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

  // Load user's quest templates: global defaults (isGlobal: true) + this
  // user's custom quests. Two separate equality queries merged in memory,
  // rather than a single `where('userId', 'in', [userId, null])` — that idiom
  // relies on subtle null-equality semantics and doesn't extend cleanly if
  // another "shared" scope is added later.
  //
  // Also queries the legacy `userId == null` shape for quest docs seeded
  // before the isGlobal flag existed, so pre-existing users aren't re-seeded
  // with duplicate quest templates; seedDefaultQuests uses deterministic doc
  // IDs, so once it runs it overwrites those legacy docs with isGlobal: true.
  const [globalSnap, legacyGlobalSnap, customSnap] = await Promise.all([
    db.collection('quests').where('isGlobal', '==', true).get(),
    db.collection('quests').where('userId', '==', null).get(),
    db.collection('quests').where('userId', '==', userId).get(),
  ]);
  const byId = new Map();
  for (const doc of [...globalSnap.docs, ...legacyGlobalSnap.docs, ...customSnap.docs]) {
    byId.set(doc.id, doc);
  }

  // If no quests exist for user, seed defaults first
  let questDocs = [...byId.values()];
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
    batch.set(ref, { ...q, isGlobal: true }); // shared global quests
  }

  await batch.commit();

  // Return as mock docs for immediate use
  return DEFAULT_QUESTS.map((q) => {
    const docId = `default_${q.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    return { id: docId, data: () => q };
  });
}

/**
 * Update progress on a daily quest. Awards XP + updates streak/rank on completion.
 *
 * The quest-completion write and all reward calculations (XP, bonus XP, streak,
 * rank/titles) run inside a single Firestore transaction, so either everything
 * commits together or nothing does — no risk of a quest being marked complete
 * without its reward, or of two concurrent submissions clobbering each other's
 * XP/streak/rank writes.
 *
 * Rank stats (derived from historical quests/challenges) are read once before
 * the transaction starts, since they're read-only inputs to the rank check and
 * not themselves being concurrently mutated by this operation. This means a
 * quest completed in *this* call won't count toward its own rank check — it'll
 * be picked up on the next quest/challenge/boss completion, same as before.
 */
async function updateQuestProgress(dailyQuestId, userId, newValue) {
  const dqRef = db.collection('dailyQuests').doc(dailyQuestId);
  const userRef = db.collection('users').doc(userId);
  const stats = await getUserStats(userId);

  return db.runTransaction(async (tx) => {
    const dqSnap = await tx.get(dqRef);
    if (!dqSnap.exists) throw new AppError('Daily quest not found', 404);

    const dq = dqSnap.data();
    if (dq.userId !== userId) throw new AppError('Unauthorized', 403);
    if (dq.completed) return { alreadyCompleted: true };

    const questRef = db.collection('quests').doc(dq.questId);
    const [questSnap, userSnap] = await Promise.all([tx.get(questRef), tx.get(userRef)]);
    if (!questSnap.exists) throw new AppError('Quest template not found', 404);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const quest = questSnap.data();

    // Use scaled target if present (new docs), fall back to template targetValue (old docs)
    const target = dq.currentTarget ?? quest.targetValue;
    const isComplete = newValue >= target;

    tx.update(dqRef, { currentValue: newValue, completed: isComplete });

    let xpResult = null;
    let streakResult = null;
    let rankResult = null;
    let bonusXp = null;

    if (isComplete) {
      let user = userSnap.data();
      const userUpdates = {};

      // Base XP
      const xpGain = computeXpGain(user, quest.xpReward);
      Object.assign(userUpdates, xpGain.updates);
      xpResult = xpGain.result;
      user = { ...user, ...xpGain.updates };

      // Overperformance bonus: up to 50% extra XP for exceeding the target
      if (newValue > target) {
        const overRatio = Math.min((newValue - target) / target, OVERPERFORMANCE_CAP);
        const bonusAmount = Math.floor(quest.xpReward * overRatio);
        if (bonusAmount > 0) {
          bonusXp = bonusAmount;
          const bonusGain = computeXpGain(user, bonusAmount);
          Object.assign(userUpdates, bonusGain.updates);
          xpResult = { ...bonusGain.result, xpGained: xpResult.xpGained + bonusAmount, previousLevel: xpResult.previousLevel };
          user = { ...user, ...bonusGain.updates };
        }
      }

      // Streak
      const streakUpdate = computeStreakUpdate(user);
      Object.assign(userUpdates, streakUpdate.updates);
      streakResult = streakUpdate.result;
      user = { ...user, ...streakUpdate.updates };

      // Rank / titles
      const promotion = computePromotion(user, stats);
      Object.assign(userUpdates, promotion.updates);
      rankResult = promotion.result;

      tx.update(userRef, userUpdates);
    }

    return {
      completed:    isComplete,
      currentValue: newValue,
      xp:           xpResult,
      streak:       streakResult,
      rank:         rankResult,
      bonusXp,
    };
  });
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
