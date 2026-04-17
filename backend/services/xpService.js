const { db } = require('../config/firebase');

const BASE_XP = 100;

function xpRequiredForLevel(level) {
  return Math.floor(BASE_XP * Math.pow(1.5, level));
}

async function addXp(userId, amount) {
  const userRef  = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) throw new Error('User not found');

  const user          = userSnap.data();
  const previousLevel = user.level || 1;
  let newXp           = (user.xp || 0) + amount;
  let newLevel        = previousLevel;

  // Level up loop — handle multiple level-ups at once
  while (newXp >= xpRequiredForLevel(newLevel)) {
    newXp -= xpRequiredForLevel(newLevel);
    newLevel++;
  }

  newXp = Math.max(0, newXp);

  await userRef.update({ xp: newXp, level: newLevel });

  return {
    xp:            newXp,
    level:         newLevel,
    xpGained:      amount,
    leveledUp:     newLevel > previousLevel,
    previousLevel,
  };
}

module.exports = { addXp, xpRequiredForLevel };
