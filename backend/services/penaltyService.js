const { db } = require('../config/firebase');
const { addXp } = require('./xpService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.round(
    (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000
  );
}

// ─── Penalty quest template ───────────────────────────────────────────────────

function buildPenaltyData(userId, level) {
  // Scales slightly with level, floored at 30 reps
  const targetValue = Math.max(30, Math.round(40 + (level - 1) * 2));
  const xpPenalty   = Math.round(100 + level * 10);

  return {
    userId,
    date: todayStr(),
    title:       'Penalty Quest: Return from the Shadows',
    description: 'You disappeared. The system does not forget. Complete this or face the consequences.',
    targetValue,
    currentValue: 0,
    unit:         'reps',
    xpPenalty,    // XP deducted on next login if not completed
    completed:    false,
    expired:      false,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called on login. Checks for missed days and:
 *  1. Applies XP deduction for any uncompleted penalty from a prior day.
 *  2. Generates a new penalty quest for today if the user missed a day.
 */
async function generatePenalty(userId) {
  const today     = todayStr();
  const yesterday = yesterdayStr();

  // Already generated for today?
  const todayCheck = await db
    .collection('penaltyQuests')
    .where('userId', '==', userId)
    .where('date', '==', today)
    .limit(1)
    .get();

  if (!todayCheck.empty) return { generated: false, message: 'Already generated' };

  // Fetch user
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  // Did the user actually miss a day?
  if (!user.lastActiveDate || user.lastActiveDate >= yesterday) {
    return { generated: false, message: 'No missed days' };
  }

  // --- Apply deduction for the most recent uncompleted penalty ---
  const staleSnap = await db
    .collection('penaltyQuests')
    .where('userId', '==', userId)
    .where('completed', '==', false)
    .where('expired', '==', false)
    .get();

  for (const doc of staleSnap.docs) {
    const p = doc.data();
    if (p.date < today) {
      await addXp(userId, -p.xpPenalty);
      await doc.ref.update({ expired: true });
    }
  }

  // --- Generate today's penalty ---
  const penaltyData = buildPenaltyData(userId, user.level || 1);
  const ref = db.collection('penaltyQuests').doc();
  await ref.set(penaltyData);

  return { generated: true, penalty: { id: ref.id, ...penaltyData } };
}

/** Returns the active (non-expired) penalty quest for today, if any. */
async function getActivePenalty(userId) {
  const snap = await db
    .collection('penaltyQuests')
    .where('userId', '==', userId)
    .where('date', '==', todayStr())
    .where('expired', '==', false)
    .limit(1)
    .get();

  if (snap.empty) return { penalty: null };
  const doc = snap.docs[0];
  return { penalty: { id: doc.id, ...doc.data() } };
}

/** Update progress on a penalty quest. */
async function updatePenaltyProgress(penaltyId, userId, newValue) {
  const ref  = db.collection('penaltyQuests').doc(penaltyId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Penalty quest not found');

  const penalty = snap.data();
  if (penalty.userId !== userId) throw new Error('Unauthorized');
  if (penalty.completed)         return { alreadyCompleted: true };
  if (penalty.expired)           return { expired: true };

  const clampedValue = Math.min(newValue, penalty.targetValue);
  const isComplete   = clampedValue >= penalty.targetValue;

  await ref.update({ currentValue: clampedValue, completed: isComplete });
  return { completed: isComplete, currentValue: clampedValue };
}

module.exports = { generatePenalty, getActivePenalty, updatePenaltyProgress };
