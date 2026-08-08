const { db } = require('../config/firebase');
const { AppError } = require('../utils/AppError');

const BASE_XP = 100;

function xpRequiredForLevel(level) {
  return Math.floor(BASE_XP * Math.pow(1.5, level));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Stable hash: true for ~10% of userId × day combinations. Deterministic so
// repeated calls within the same day agree without needing to persist state —
// the System Log event generator and the actual reward calculators below both
// call this and always land on the same answer for a given user/day.
function isDoubleXpActive(userId) {
  let h = 0;
  for (const c of `${userId}_${todayStr()}_2x`) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 10 === 0;
}

/**
 * Pure function: given a user doc and an XP delta, computes the new xp/level.
 * Does no I/O — callers decide how/when to persist `updates`.
 */
function computeXpGain(user, amount) {
  const previousLevel = user.level || 1;
  let newXp           = (user.xp || 0) + amount;
  let newLevel        = previousLevel;

  // Level up loop — handle multiple level-ups at once
  while (newXp >= xpRequiredForLevel(newLevel)) {
    newXp -= xpRequiredForLevel(newLevel);
    newLevel++;
  }

  newXp = Math.max(0, newXp);

  return {
    updates: { xp: newXp, level: newLevel },
    result: {
      xp:            newXp,
      level:         newLevel,
      xpGained:      amount,
      leveledUp:     newLevel > previousLevel,
      previousLevel,
    },
  };
}

// Wrapped in a transaction so concurrent calls (double-tap, retry, multi-tab)
// can't both read the same stale xp/level and clobber each other's write.
async function addXp(userId, amount) {
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new AppError('User not found', 404);

    const { updates, result } = computeXpGain(userSnap.data(), amount);
    tx.update(userRef, updates);
    return result;
  });
}

/** Compute the total lifetime XP earned from level + remainder. */
function getTotalXp(level, xpRemainder) {
  let total = xpRemainder || 0;
  for (let l = 1; l < (level || 1); l++) {
    total += xpRequiredForLevel(l);
  }
  return total;
}

module.exports = { addXp, computeXpGain, xpRequiredForLevel, getTotalXp, isDoubleXpActive };
