const { db } = require('../config/firebase');
const { AppError } = require('../utils/AppError');

function today() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Pure function: given a user doc, computes the streak update for "today".
 * Does no I/O — callers decide how/when to persist `updates`.
 */
function computeStreakUpdate(user) {
  const todayStr = today();
  const lastActive = user.lastActiveDate;

  // Already counted today
  if (lastActive === todayStr) return { updates: {}, result: { streakCount: user.streakCount } };

  let newStreak;
  const updates = { lastActiveDate: todayStr };

  if (lastActive === yesterday()) {
    newStreak = (user.streakCount || 0) + 1;
  } else {
    newStreak = 1;
    // Track how many times the user recovers after breaking a streak
    if ((user.streakCount || 0) > 0) {
      updates.recoverCount = (user.recoverCount || 0) + 1;
    }
  }

  updates.streakCount = newStreak;
  return { updates, result: { streakCount: newStreak } };
}

// Wrapped in a transaction so concurrent calls can't both read the same
// stale streakCount/lastActiveDate and clobber each other's write.
async function updateStreak(userId) {
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const { updates, result } = computeStreakUpdate(userSnap.data());
    if (Object.keys(updates).length > 0) tx.update(userRef, updates);
    return result;
  });
}

module.exports = { updateStreak, computeStreakUpdate };
