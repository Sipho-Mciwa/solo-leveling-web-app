const { db } = require('../config/firebase');
const { getUserStats } = require('./statsService');

// ─── Rank chain & requirements ─────────────────────────────────────────────────

const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];

// Each rank's promotion criteria — all must be met simultaneously.
const RANK_REQUIREMENTS = {
  D: [
    { id: 'level',  label: 'Level',     target: 5,  type: 'level'  },
    { id: 'streak', label: 'Streak',    target: 3,  type: 'streak' },
  ],
  C: [
    { id: 'level',      label: 'Level',      target: 10, type: 'level'  },
    { id: 'streak',     label: 'Streak',     target: 7,  type: 'streak' },
    { id: 'DISCIPLINE', label: 'Discipline', target: 40, type: 'stat'   },
  ],
  B: [
    { id: 'level',      label: 'Level',      target: 20, type: 'level'  },
    { id: 'streak',     label: 'Streak',     target: 14, type: 'streak' },
    { id: 'PHY',        label: 'PHY',        target: 40, type: 'stat'   },
    { id: 'DISCIPLINE', label: 'Discipline', target: 60, type: 'stat'   },
  ],
  A: [
    { id: 'level',      label: 'Level',      target: 35, type: 'level'  },
    { id: 'streak',     label: 'Streak',     target: 21, type: 'streak' },
    { id: 'PHY',        label: 'PHY',        target: 60, type: 'stat'   },
    { id: 'DISCIPLINE', label: 'Discipline', target: 70, type: 'stat'   },
    { id: 'STAMINA',    label: 'Stamina',    target: 40, type: 'stat'   },
  ],
  S: [
    { id: 'level',      label: 'Level',      target: 50, type: 'level'  },
    { id: 'streak',     label: 'Streak',     target: 30, type: 'streak' },
    { id: 'PHY',        label: 'PHY',        target: 75, type: 'stat'   },
    { id: 'DISCIPLINE', label: 'Discipline', target: 80, type: 'stat'   },
    { id: 'STAMINA',    label: 'Stamina',    target: 60, type: 'stat'   },
    { id: 'INTELLECT',  label: 'Intellect',  target: 50, type: 'stat'   },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getCriterionValue(req, user, stats) {
  if (req.type === 'level')  return user.level  || 1;
  if (req.type === 'streak') return user.streakCount || 0;
  if (req.type === 'stat')   return stats[req.id]  || 0;
  return 0;
}

function checkAllMet(reqs, user, stats) {
  return reqs.every((req) => getCriterionValue(req, user, stats) >= req.target);
}

// ─── Core rank evaluation ──────────────────────────────────────────────────────

/**
 * Idempotent, upgrade-only rank update.
 * Reads current rank, tries to promote one rank at a time.
 * Also awards the shadow_monarch title on S-Rank.
 */
async function updateUserRank(userId) {
  const [userSnap, stats] = await Promise.all([
    db.collection('users').doc(userId).get(),
    getUserStats(userId),
  ]);
  if (!userSnap.exists) throw new Error('User not found');

  const user         = userSnap.data();
  const currentRank  = user.rank || 'E';
  const currentIdx   = RANK_ORDER.indexOf(currentRank);

  let promotedRank = currentRank;

  for (let i = currentIdx + 1; i < RANK_ORDER.length; i++) {
    const target = RANK_ORDER[i];
    if (checkAllMet(RANK_REQUIREMENTS[target], user, stats)) {
      promotedRank = target;
    } else {
      break;
    }
  }

  const updates = { rank: promotedRank };

  // Award shadow_monarch title on S-Rank (fire-and-forget handled by caller)
  if (promotedRank === 'S') {
    const existingTitles = user.titles || [];
    if (!existingTitles.includes('shadow_monarch')) {
      updates.titles = [...existingTitles, 'shadow_monarch'];
      if (!user.activeTitle) updates.activeTitle = 'shadow_monarch';
    }
  }

  if (!user.activeTitle && (user.titles?.length ?? 0) > 0) {
    updates.activeTitle = user.titles[0];
  }

  await db.collection('users').doc(userId).update(updates);

  return {
    rank:        promotedRank,
    titles:      updates.titles ?? user.titles ?? [],
    activeTitle: updates.activeTitle ?? user.activeTitle ?? null,
    promoted:    promotedRank !== currentRank,
  };
}

/**
 * Returns current rank data and triggers re-evaluation.
 */
async function getUserRank(userId) {
  return updateUserRank(userId);
}

/**
 * Returns current value vs target for each criterion of the NEXT rank.
 */
async function getRankProgress(userId) {
  const [userSnap, stats] = await Promise.all([
    db.collection('users').doc(userId).get(),
    getUserStats(userId),
  ]);
  if (!userSnap.exists) throw new Error('User not found');

  const user        = userSnap.data();
  const currentRank = user.rank || 'E';

  if (currentRank === 'S') {
    return { currentRank: 'S', nextRank: null, criteria: [], metCount: 0, totalCount: 0, canPromote: false };
  }

  const currentIdx = RANK_ORDER.indexOf(currentRank);
  const nextRank   = RANK_ORDER[currentIdx + 1];
  const reqs       = RANK_REQUIREMENTS[nextRank];

  const criteria = reqs.map((req) => {
    const current = getCriterionValue(req, user, stats);
    return {
      label:   req.label,
      current: Math.min(current, req.target),
      target:  req.target,
      met:     current >= req.target,
      type:    req.type,
    };
  });

  const metCount = criteria.filter((c) => c.met).length;

  return {
    currentRank,
    nextRank,
    criteria,
    metCount,
    totalCount:  criteria.length,
    canPromote:  metCount === criteria.length,
  };
}

/**
 * Switch which title is active. Accepts both new IDs and legacy name strings.
 */
async function setActiveTitle(userId, title) {
  const userRef  = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data();

  if (!user.titles?.includes(title)) throw new Error('Title not earned yet');
  await userRef.update({ activeTitle: title });
  return { activeTitle: title };
}

module.exports = { updateUserRank, getUserRank, getRankProgress, setActiveTitle, RANK_REQUIREMENTS, RANK_ORDER };
