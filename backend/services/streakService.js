const { db } = require('../config/firebase');

function today() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function updateStreak(userId) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) throw new Error('User not found');

  const user = userSnap.data();
  const todayStr = today();
  const lastActive = user.lastActiveDate;

  // Already counted today
  if (lastActive === todayStr) return { streakCount: user.streakCount };

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
  await userRef.update(updates);

  return { streakCount: newStreak };
}

module.exports = { updateStreak };
