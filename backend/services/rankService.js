const { db } = require('../config/firebase');

// ─── Rank configuration ───────────────────────────────────────────────────────

const RANK_THRESHOLDS = [
  { rank: 'S', minScore: 80 },
  { rank: 'A', minScore: 50 },
  { rank: 'B', minScore: 30 },
  { rank: 'C', minScore: 15 },
  { rank: 'D', minScore: 6  },
  { rank: 'E', minScore: 0  },
];

// Titles are awarded in order — once earned they're permanent
const TITLE_MILESTONES = [
  { title: 'E Rank Hunter',    condition: ()       => true                          },
  { title: 'Iron Will',        condition: (u)      => (u.streakCount || 0) >= 7    },
  { title: 'Shadow Walker',    condition: (u)      => (u.level || 1) >= 10         },
  { title: "Death's Apostle",  condition: (u, r)   => ['B','A','S'].includes(r)    },
  { title: 'Shadow Monarch',   condition: (u, r)   => r === 'S'                    },
];

// ─── Pure functions ───────────────────────────────────────────────────────────

function calculateRankScore(level, streak) {
  return (level || 1) * 2 + Math.min(streak || 0, 60);
}

function getRankFromScore(score) {
  for (const { rank, minScore } of RANK_THRESHOLDS) {
    if (score >= minScore) return rank;
  }
  return 'E';
}

function computeNewTitles(user, newRank, existingTitles) {
  const titles = [...existingTitles];
  for (const { title, condition } of TITLE_MILESTONES) {
    if (!titles.includes(title) && condition(user, newRank)) {
      titles.push(title);
    }
  }
  return titles;
}

// ─── Firestore operations ─────────────────────────────────────────────────────

/**
 * Recalculate and persist rank + titles for a user.
 * Called after quest completion and on login.
 */
async function updateUserRank(userId) {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  const score   = calculateRankScore(user.level, user.streakCount);
  const newRank = getRankFromScore(score);

  const existingTitles = user.titles?.length ? user.titles : ['E Rank Hunter'];
  const newTitles      = computeNewTitles(user, newRank, existingTitles);

  const updates = { rank: newRank, titles: newTitles };
  // Set a default activeTitle on first calculation
  if (!user.activeTitle) updates.activeTitle = newTitles[0];

  await userRef.update(updates);

  return {
    rank:        newRank,
    titles:      newTitles,
    activeTitle: user.activeTitle || newTitles[0] || null,
  };
}

/** Read current rank data without recalculating. */
async function getUserRank(userId) {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  // Recalculate on read so it's always fresh
  return updateUserRank(userId);
}

/** Switch which title is displayed. */
async function setActiveTitle(userId, title) {
  const userRef  = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  if (!user.titles?.includes(title)) throw new Error('Title not earned yet');
  await userRef.update({ activeTitle: title });
  return { activeTitle: title };
}

module.exports = { updateUserRank, getUserRank, setActiveTitle, getRankFromScore, calculateRankScore };
