const { db } = require('../config/firebase');
const { addXp } = require('./xpService');
const { evaluateTitles } = require('./titleService');
const { updateUserRank } = require('./rankService');

const CHALLENGES = [
  { key: 'wake_up_5am',    title: 'Wake up 5:00 AM',  xpReward: 20 },
  { key: 'drink_2l_water', title: 'Drink 2L water',   xpReward: 15 },
  { key: 'make_bed',       title: 'Make bed',         xpReward: 10 },
  { key: 'bath',           title: 'Bath',             xpReward: 10 },
  { key: 'read_10_pages',  title: 'Read 10 pages',    xpReward: 20 },
  { key: 'sleep_2130',     title: 'Sleep 21:30',      xpReward: 25 },
];

const ALL_COMPLETE_BONUS = 100;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generates today's daily challenges for a user if they don't exist yet.
 * Called on login.
 */
async function generateDailyChallenges(userId) {
  const date = todayStr();

  const existing = await db
    .collection('dailyChallenges')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { generated: false, message: 'Already generated for today' };
  }

  await db.collection('dailyChallenges').add({
    userId,
    date,
    challenges: CHALLENGES.map((c) => ({ ...c, completed: false })),
    bonusAwarded: false,
  });

  return { generated: true, message: 'Daily challenges created' };
}

/**
 * Returns today's challenge document for a user.
 */
async function getTodayChallenges(userId) {
  const date = todayStr();

  const snapshot = await db
    .collection('dailyChallenges')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Marks a single challenge as complete and awards XP.
 * Awards +100 XP bonus if all challenges are now complete.
 */
async function completeChallenge(docId, userId, challengeKey) {
  const ref = db.collection('dailyChallenges').doc(docId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error('Daily challenges not found');

  const data = snap.data();
  if (data.userId !== userId) throw new Error('Unauthorized');

  const challenge = data.challenges.find((c) => c.key === challengeKey);
  if (!challenge) throw new Error('Challenge not found');
  if (challenge.completed) return { alreadyCompleted: true };

  const updatedChallenges = data.challenges.map((c) =>
    c.key === challengeKey ? { ...c, completed: true } : c
  );

  const allComplete = updatedChallenges.every((c) => c.completed);
  const shouldAwardBonus = allComplete && !data.bonusAwarded;

  await ref.update({
    challenges: updatedChallenges,
    ...(shouldAwardBonus ? { bonusAwarded: true } : {}),
  });

  const xpResult = await addXp(userId, challenge.xpReward);

  let bonusXpResult = null;
  if (shouldAwardBonus) {
    bonusXpResult = await addXp(userId, ALL_COMPLETE_BONUS);
  }

  if (allComplete) {
    evaluateTitles(userId).catch((e) => console.error('[TitleService] eval error:', e));
    updateUserRank(userId).catch((e) => console.error('[RankService] update error:', e));
  }

  return {
    completed: true,
    xp: xpResult,
    bonusAwarded: shouldAwardBonus,
    bonusXp: bonusXpResult,
    allComplete,
  };
}

/**
 * Returns monthly challenge history grouped by challenge key, with per-day completion data.
 * Requires a Firestore composite index on: dailyChallenges (userId ASC, date ASC).
 * If the query fails with "index required", use the URL in the error to create it.
 */
async function getChallengeHistory(userId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const snapshot = await db
    .collection('dailyChallenges')
    .where('userId', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  if (snapshot.empty) return { challenges: [] };

  // Build: { [key]: { key, title, history: { [date]: { completed } } } }
  const byKey = {};
  for (const doc of snapshot.docs) {
    const data = doc.data();
    for (const c of data.challenges) {
      if (!byKey[c.key]) {
        byKey[c.key] = { key: c.key, title: c.title, history: {} };
      }
      byKey[c.key].history[data.date] = { completed: c.completed };
    }
  }

  // Preserve canonical CHALLENGES order
  const challenges = CHALLENGES.filter((c) => byKey[c.key]).map((c) => byKey[c.key]);

  return { challenges };
}

module.exports = {
  generateDailyChallenges,
  getTodayChallenges,
  completeChallenge,
  getChallengeHistory,
  CHALLENGES,
  ALL_COMPLETE_BONUS,
};
