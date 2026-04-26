const { db } = require('../config/firebase');
const { TITLE_DEFS, TITLE_CATEGORIES, CATEGORY_ORDER } = require('./titleDefinitions');

// ─── Data gathering ────────────────────────────────────────────────────────────

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Batch-fetch all data needed for title evaluation in 5 parallel reads.
 */
async function gatherData(userId) {
  const windowStart = nDaysAgo(179); // 180-day window for history checks

  const [userSnap, activitiesSnap, challengesSnap, questsSnap, bossSnap, weekendBossSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('processedActivities').where('userId', '==', userId).get(),
    db.collection('dailyChallenges').where('userId', '==', userId).where('date', '>=', windowStart).get(),
    db.collection('dailyQuests').where('userId', '==', userId).where('date', '>=', windowStart).get(),
    db.collection('bossQuests').where('userId', '==', userId).where('completed', '==', true).get(),
    db.collection('weekendBossChallenges').where('userId', '==', userId).where('status', '==', 'claimed').get(),
  ]);

  if (!userSnap.exists) throw new Error('User not found');

  const user            = userSnap.data();
  const activities      = activitiesSnap.docs.map((d) => d.data());
  const challengeDocs   = challengesSnap.docs.map((d) => d.data()).sort((a, b) => a.date.localeCompare(b.date));
  const questDocs       = questsSnap.docs.map((d) => d.data());

  const legacyBosses    = bossSnap.docs.length;
  const weekendBosses   = weekendBossSnap.docs.length;
  const completedBosses = legacyBosses + weekendBosses;

  // ── Derived: running totals ────────────────────────────────────────────────
  const totalRunCount   = activities.length;
  const totalDistanceKm = activities.reduce((s, a) => s + (a.distance || 0) / 1000, 0);

  // ── Derived: challenge maps ────────────────────────────────────────────────
  // perfectDates: sorted array of dates where bonusAwarded = true (all 6 complete)
  const perfectDates = challengeDocs
    .filter((d) => d.bonusAwarded === true || (d.challenges || []).every((c) => c.completed))
    .map((d) => d.date)
    .sort();

  // perfectDaysCount: total number of days with all challenges complete
  const perfectDaysCount = perfectDates.length;

  // longestPerfectStreak: longest consecutive run of perfect-challenge days
  const longestPerfectStreak = longestConsecutiveRun(perfectDates);

  // readingDates: sorted array of dates where read_10_pages or read_book was completed
  const readingDates = challengeDocs
    .filter((d) => (d.challenges || []).some((c) => (c.key === 'read_10_pages' || c.key === 'read_book') && c.completed))
    .map((d) => d.date)
    .sort();
  const readingDaysCount    = readingDates.length;
  const longestReadingStreak = longestConsecutiveRun(readingDates);

  // wakeUpDaysCount: total days with wake_up_5am or wake_up_6am completed
  const wakeUpDaysCount = challengeDocs.filter(
    (d) => (d.challenges || []).some((c) => (c.key === 'wake_up_5am' || c.key === 'wake_up_6am') && c.completed)
  ).length;

  // ── Derived: quest maps ────────────────────────────────────────────────────
  // Per-date quest summary: { total, completed }
  const questByDate = {};
  for (const dq of questDocs) {
    if (!questByDate[dq.date]) questByDate[dq.date] = { total: 0, completed: 0 };
    questByDate[dq.date].total++;
    if (dq.completed) questByDate[dq.date].completed++;
  }

  // perfectQuestDates: dates where all quests were completed (at least 1 quest)
  const perfectQuestDates = Object.entries(questByDate)
    .filter(([, v]) => v.total > 0 && v.completed === v.total)
    .map(([date]) => date)
    .sort();
  const longestQuestStreak = longestConsecutiveRun(perfectQuestDates);

  // beast_mode: dates where ALL quests AND all challenges were perfect
  const perfectChallengeDateSet = new Set(perfectDates);
  const perfectQuestDateSet     = new Set(perfectQuestDates);
  const beastDaysCount = [...perfectChallengeDateSet].filter((d) => perfectQuestDateSet.has(d)).length;

  return {
    user,
    totalRunCount,
    totalDistanceKm,
    completedBosses,
    perfectDaysCount,
    longestPerfectStreak,
    readingDaysCount,
    longestReadingStreak,
    wakeUpDaysCount,
    longestQuestStreak,
    beastDaysCount,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the longest run of consecutive calendar days in a sorted date array.
 */
function longestConsecutiveRun(sortedDates) {
  if (!sortedDates.length) return 0;
  let best    = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
    const cur  = new Date(sortedDates[i]     + 'T00:00:00');
    const diff = Math.round((cur - prev) / 86_400_000);
    current    = diff === 1 ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

// ─── Condition & progress checks ──────────────────────────────────────────────

/** Returns true if the title condition is met by the gathered data. */
function checkCondition(id, d) {
  const u = d.user;
  switch (id) {
    // Consistency
    case 'consistent_i':   return (u.streakCount || 0) >= 3;
    case 'consistent_ii':  return (u.streakCount || 0) >= 7;
    case 'consistent_iii': return (u.streakCount || 0) >= 14;
    case 'consistent_iv':  return (u.streakCount || 0) >= 30;
    // Running
    case 'runner_i':   return d.totalRunCount >= 1;
    case 'runner_ii':  return d.totalRunCount >= 10;
    case 'runner_iii': return d.totalDistanceKm >= 100;
    case 'runner_iv':  return d.totalDistanceKm >= 200;
    // Discipline
    case 'discipline_i':   return d.perfectDaysCount >= 1;
    case 'discipline_ii':  return d.longestPerfectStreak >= 3;
    case 'discipline_iii': return d.longestPerfectStreak >= 7;
    case 'discipline_iv':  return d.perfectDaysCount >= 30;
    // Intellect
    case 'intellect_i':   return d.readingDaysCount >= 7;
    case 'intellect_ii':  return d.readingDaysCount >= 20;
    case 'intellect_iii': return d.readingDaysCount >= 50;
    case 'intellect_iv':  return d.longestReadingStreak >= 7;
    // Recovery
    case 'recovery_i':   return (u.recoverCount || 0) >= 1;
    case 'recovery_ii':  return (u.recoverCount || 0) >= 3;
    case 'recovery_iii': return (u.recoverCount || 0) >= 5;
    case 'recovery_iv':  return (u.recoverCount || 0) >= 10;
    // Boss
    case 'boss_i':   return d.completedBosses >= 1;
    case 'boss_ii':  return d.completedBosses >= 3;
    case 'boss_iii': return d.completedBosses >= 7;
    case 'boss_iv':  return d.completedBosses >= 15;
    // Rare
    case 'beast_mode':     return d.beastDaysCount >= 1;
    case 'perfect_week':   return d.longestQuestStreak >= 7;
    case 'early_riser':    return d.wakeUpDaysCount >= 14;
    case 'shadow_monarch': return (u.rank || 'E') === 'S';
    default: return false;
  }
}

/** Returns { current, target } for progress bar display. Null = no sub-progress. */
function getProgress(id, d) {
  const u = d.user;
  switch (id) {
    case 'consistent_i':   return { current: Math.min(u.streakCount || 0, 3),   target: 3   };
    case 'consistent_ii':  return { current: Math.min(u.streakCount || 0, 7),   target: 7   };
    case 'consistent_iii': return { current: Math.min(u.streakCount || 0, 14),  target: 14  };
    case 'consistent_iv':  return { current: Math.min(u.streakCount || 0, 30),  target: 30  };
    case 'runner_i':   return { current: Math.min(d.totalRunCount, 1),   target: 1   };
    case 'runner_ii':  return { current: Math.min(d.totalRunCount, 10),  target: 10  };
    case 'runner_iii': return { current: Math.min(Math.round(d.totalDistanceKm), 100), target: 100 };
    case 'runner_iv':  return { current: Math.min(Math.round(d.totalDistanceKm), 200), target: 200 };
    case 'discipline_i':   return { current: Math.min(d.perfectDaysCount, 1),   target: 1  };
    case 'discipline_ii':  return { current: Math.min(d.longestPerfectStreak, 3),  target: 3  };
    case 'discipline_iii': return { current: Math.min(d.longestPerfectStreak, 7),  target: 7  };
    case 'discipline_iv':  return { current: Math.min(d.perfectDaysCount, 30),  target: 30 };
    case 'intellect_i':   return { current: Math.min(d.readingDaysCount, 7),   target: 7  };
    case 'intellect_ii':  return { current: Math.min(d.readingDaysCount, 20),  target: 20 };
    case 'intellect_iii': return { current: Math.min(d.readingDaysCount, 50),  target: 50 };
    case 'intellect_iv':  return { current: Math.min(d.longestReadingStreak, 7), target: 7 };
    case 'recovery_i':   return { current: Math.min(u.recoverCount || 0, 1),   target: 1  };
    case 'recovery_ii':  return { current: Math.min(u.recoverCount || 0, 3),   target: 3  };
    case 'recovery_iii': return { current: Math.min(u.recoverCount || 0, 5),   target: 5  };
    case 'recovery_iv':  return { current: Math.min(u.recoverCount || 0, 10),  target: 10 };
    case 'boss_i':   return { current: Math.min(d.completedBosses, 1),   target: 1  };
    case 'boss_ii':  return { current: Math.min(d.completedBosses, 3),   target: 3  };
    case 'boss_iii': return { current: Math.min(d.completedBosses, 7),   target: 7  };
    case 'boss_iv':  return { current: Math.min(d.completedBosses, 15),  target: 15 };
    case 'beast_mode':     return { current: Math.min(d.beastDaysCount, 1), target: 1  };
    case 'perfect_week':   return { current: Math.min(d.longestQuestStreak, 7), target: 7 };
    case 'early_riser':    return { current: Math.min(d.wakeUpDaysCount, 14), target: 14 };
    case 'shadow_monarch': return null;
    default: return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate all title conditions and persist newly earned titles.
 * Safe to call fire-and-forget.
 */
async function evaluateTitles(userId) {
  const data    = await gatherData(userId);
  const user    = data.user;
  const current = new Set(user.titles || []);

  const newlyEarned = [];
  for (const id of Object.keys(TITLE_DEFS)) {
    if (!current.has(id) && checkCondition(id, data)) {
      current.add(id);
      newlyEarned.push(id);
    }
  }

  if (!newlyEarned.length) return { newlyEarned: [] };

  const updatedTitles = [...(user.titles || []), ...newlyEarned];
  const updates = { titles: updatedTitles };
  if (!user.activeTitle) updates.activeTitle = updatedTitles[0];

  await db.collection('users').doc(userId).update(updates);
  return { newlyEarned };
}

/**
 * Return full title progress for the titles page.
 * Each entry includes definition data + unlock state + progress bar values.
 */
async function getTitleProgress(userId) {
  const data    = await gatherData(userId);
  const earned  = new Set(data.user.titles || []);
  const active  = data.user.activeTitle;

  const titles = [];
  for (const cat of TITLE_CATEGORIES) {
    for (const id of CATEGORY_ORDER[cat]) {
      const def      = TITLE_DEFS[id];
      const unlocked = earned.has(id);
      const progress = unlocked ? null : getProgress(id, data);
      titles.push({
        ...def,
        unlocked,
        active:   active === id,
        progress, // null when unlocked (no need to show bar)
      });
    }
  }

  return { titles, categories: TITLE_CATEGORIES };
}

module.exports = { evaluateTitles, getTitleProgress, gatherData };
