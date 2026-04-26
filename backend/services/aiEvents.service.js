// ─── AI Events Service ────────────────────────────────────────────────────────
// Generates proactive, time-aware system events based on user performance
// patterns, memory, and deterministic special event triggers.
//
// Event types:  system | warning | alert | narrative | special
// Cache:        30-minute rolling window (per user)
// Anti-spam:    max 6 events per window, deduped by ID
// ─────────────────────────────────────────────────────────────────────────────

const { db } = require('../config/firebase');

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PRIORITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const TYPE = { SYSTEM: 'system', WARNING: 'warning', ALERT: 'alert', NARRATIVE: 'narrative', SPECIAL: 'special' };
const ICON = { SYSTEM: 'system', WARNING: 'warning', TROPHY: 'trophy', BOSS: 'boss', STAR: 'star', XP: 'xp' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr  = () => new Date().toISOString().split('T')[0];
const nowHour   = () => new Date().getHours();
const nowDOW    = () => new Date().getDay();         // 0 = Sunday
const nowDOWLabel = () => DAY_NAMES[new Date().getDay()];
const nowISO    = () => new Date().toISOString();

function makeId(segment, suffix) {
  return suffix ? `${segment}_${todayStr()}_${suffix}` : `${segment}_${todayStr()}`;
}

// Stable hash: true for ~10% of userId × day combinations
function doubleXPToday(userId) {
  let h = 0;
  for (const c of `${userId}_${todayStr()}_2x`) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 10 === 0;
}

// Stable hash: true for ~20% of userId × week combinations
function eliteBossThisWeek(userId) {
  const weekNum = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  let h = 0;
  for (const c of `${userId}_${weekNum}`) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return h % 5 === 0;
}

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ─── 1. Time-Based System Messages ───────────────────────────────────────────
// One context-aware event per time window: morning / midday / evening / night.

function buildTimeEvent(questsDone, questsTotal) {
  const hour      = nowHour();
  const remaining = questsTotal - questsDone;
  const rate      = questsTotal > 0 ? Math.round((questsDone / questsTotal) * 100) : 100;

  // Morning  05:00–09:59 — board just went live
  if (hour >= 5 && hour < 10) {
    if (questsDone === 0 && questsTotal > 0) {
      return {
        id: makeId('sys', 'morning'),
        type: TYPE.SYSTEM, icon: ICON.SYSTEM, priority: PRIORITY.MEDIUM,
        title: 'DAILY BOARD ACTIVE',
        message: `${questsTotal} quest${questsTotal !== 1 ? 's' : ''} assigned. Initiate immediately.`,
        tag: 'SYSTEM', timestamp: nowISO(), seen: false,
      };
    }
    return null;
  }

  // Midday   12:00–13:59 — pace check
  if (hour >= 12 && hour < 14 && questsTotal > 0) {
    if (rate < 50) {
      return {
        id: makeId('sys', 'midday'),
        type: TYPE.WARNING, icon: ICON.WARNING, priority: PRIORITY.HIGH,
        title: 'MIDDAY CHECKPOINT',
        message: `${questsDone}/${questsTotal} complete. Below pace — intervene now.`,
        tag: 'WARNING', timestamp: nowISO(), seen: false,
      };
    }
    if (rate < 100) {
      return {
        id: makeId('sys', 'midday'),
        type: TYPE.SYSTEM, icon: ICON.SYSTEM, priority: PRIORITY.LOW,
        title: 'MIDDAY CHECKPOINT',
        message: `${questsDone}/${questsTotal} complete. Maintain pace through end of day.`,
        tag: 'SYSTEM', timestamp: nowISO(), seen: false,
      };
    }
    return null;
  }

  // Evening  18:00–20:59 — closing pressure
  if (hour >= 18 && hour < 21 && remaining > 0) {
    return {
      id: makeId('sys', 'evening'),
      type: TYPE.WARNING, icon: ICON.WARNING,
      priority: remaining >= 3 ? PRIORITY.CRITICAL : PRIORITY.HIGH,
      title: 'WINDOW CLOSING',
      message: `${remaining} quest${remaining !== 1 ? 's' : ''} remain. Complete before midnight or face penalty.`,
      tag: 'WARNING', timestamp: nowISO(), seen: false,
    };
  }

  // Night    21:00–23:59 — final alert
  if (hour >= 21 && remaining > 0) {
    return {
      id: makeId('sys', 'night'),
      type: TYPE.ALERT, icon: ICON.WARNING, priority: PRIORITY.CRITICAL,
      title: 'CRITICAL — DAY ENDING',
      message: `${remaining} quest${remaining !== 1 ? 's' : ''} incomplete. Streak at risk. Final window.`,
      tag: 'ALERT', timestamp: nowISO(), seen: false,
    };
  }

  return null;
}

// ─── 2. Predictive Warnings ───────────────────────────────────────────────────
// Reads memory patterns to warn before failure happens.

function buildPredictiveEvents(memory) {
  if (!memory?.patterns) return [];
  const events = [];
  const { patterns, trends } = memory;

  // Drop-off day detection
  if (patterns.dropOffDayLabel && patterns.dropOffDayLabel === nowDOWLabel()) {
    events.push({
      id: makeId('pred', 'dropoff'),
      type: TYPE.WARNING, icon: ICON.WARNING, priority: PRIORITY.HIGH,
      title: 'PATTERN DETECTED',
      message: `${patterns.dropOffDayLabel} is your weakest day (${patterns.dropOffDayCompletionRate ?? '?'}% historical rate). Override the pattern.`,
      tag: 'WARNING', timestamp: nowISO(), seen: false,
    });
  }

  // Declining completion trend
  if (trends?.questCompletion === 'declining') {
    events.push({
      id: makeId('pred', 'decline'),
      type: TYPE.WARNING, icon: ICON.WARNING, priority: PRIORITY.HIGH,
      title: 'PERFORMANCE DECLINING',
      message: 'Completion rate down vs last week. Consistent regression leads to rank instability.',
      tag: 'WARNING', timestamp: nowISO(), seen: false,
    });
  }

  // Most-missed habit
  if (patterns.mostMissedHabitTitle) {
    events.push({
      id: makeId('pred', 'habit'),
      type: TYPE.WARNING, icon: ICON.WARNING, priority: PRIORITY.MEDIUM,
      title: 'HABIT FAILURE PATTERN',
      message: `"${patterns.mostMissedHabitTitle}" — ${patterns.mostMissedHabitMissRate ?? '?'}% miss rate. Make it the first thing you do today.`,
      tag: 'WARNING', timestamp: nowISO(), seen: false,
    });
  }

  return events;
}

// ─── 3. Adaptive Pressure ─────────────────────────────────────────────────────
// One assessment event per morning, calibrated to 7-day average.

function buildAdaptivePressureEvent(memory) {
  const avg = memory?.patterns?.avgCompletionLast7;
  if (avg === null || avg === undefined) return null;

  if (avg >= 85) {
    return {
      id: makeId('press', 'elite'),
      type: TYPE.SYSTEM, icon: ICON.SYSTEM, priority: PRIORITY.LOW,
      title: 'SYSTEM ASSESSMENT',
      message: `${Math.round(avg)}% 7-day average. Elite tier. The system expects you to hold — then surpass — this standard.`,
      tag: 'SYSTEM', timestamp: nowISO(), seen: false,
    };
  }
  if (avg >= 60) {
    return {
      id: makeId('press', 'mid'),
      type: TYPE.SYSTEM, icon: ICON.SYSTEM, priority: PRIORITY.LOW,
      title: 'SYSTEM ASSESSMENT',
      message: `${Math.round(avg)}% 7-day average. Adequate. Target 80%+ this week to maintain rank standing.`,
      tag: 'SYSTEM', timestamp: nowISO(), seen: false,
    };
  }
  return {
    id: makeId('press', 'low'),
    type: TYPE.WARNING, icon: ICON.WARNING, priority: PRIORITY.HIGH,
    title: 'RANK REGRESSION RISK',
    message: `${Math.round(avg)}% 7-day average. Below minimum threshold. Rank stability compromised. Recover immediately.`,
    tag: 'WARNING', timestamp: nowISO(), seen: false,
  };
}

// ─── 4. Special Events ────────────────────────────────────────────────────────
// Rare, deterministic triggers: double XP, elite boss, perfect-week alert.

function buildSpecialEvents(userId, memory) {
  const events = [];

  // Double XP window (~10% of days, per-user deterministic)
  if (doubleXPToday(userId)) {
    events.push({
      id: makeId('special', 'double_xp'),
      type: TYPE.SPECIAL, icon: ICON.XP, priority: PRIORITY.HIGH,
      title: 'DOUBLE XP WINDOW ACTIVE',
      message: 'System anomaly detected. All quest XP is doubled until midnight. Do not waste this window.',
      tag: 'DOUBLE XP', timestamp: nowISO(), seen: false,
    });
  }

  // Elite boss — fires on Monday of a special week (~20% of weeks)
  if (eliteBossThisWeek(userId) && nowDOW() === 1) {
    events.push({
      id: makeId('special', 'elite_boss'),
      type: TYPE.SPECIAL, icon: ICON.BOSS, priority: PRIORITY.HIGH,
      title: 'ELITE BOSS DETECTED',
      message: 'A high-tier entity has emerged this week. Complete all quests and challenges today to trigger the encounter.',
      tag: 'ELITE BOSS', timestamp: nowISO(), seen: false,
    });
  }

  // Perfect-week alert — Thu through Sat when on a strong week
  const avg7 = memory?.patterns?.avgCompletionLast7;
  if (avg7 !== null && avg7 >= 80 && nowDOW() >= 4) {
    events.push({
      id: makeId('special', 'perfect_week'),
      type: TYPE.SPECIAL, icon: ICON.TROPHY, priority: PRIORITY.MEDIUM,
      title: 'PERFECT WEEK IN RANGE',
      message: 'Current trajectory projects a perfect week. Do not break the chain now.',
      tag: 'ACHIEVEMENT', timestamp: nowISO(), seen: false,
    });
  }

  return events;
}

// ─── 5. Streak Milestone ──────────────────────────────────────────────────────

function buildStreakMilestoneEvent(streakCount) {
  if (![7, 14, 21, 30, 60, 90, 180, 365].includes(streakCount)) return null;
  return {
    id: makeId('streak', String(streakCount)),
    type: TYPE.NARRATIVE, icon: ICON.STAR, priority: PRIORITY.HIGH,
    title: `${streakCount}-DAY STREAK`,
    message: `${streakCount} consecutive days. The pattern is becoming permanent. The system acknowledges your discipline.`,
    tag: 'MILESTONE', timestamp: nowISO(), seen: false,
  };
}

// ─── Main: generateSystemEvents ───────────────────────────────────────────────

async function generateSystemEvents(userId) {
  const today = todayStr();

  // 30-minute rolling cache
  const cacheRef = db.collection('aiEventCache').doc(userId);
  const cached   = await cacheRef.get().catch(() => null);
  if (cached?.exists) {
    const { date, generatedAt, events } = cached.data();
    if (date === today && generatedAt && (Date.now() - new Date(generatedAt).getTime()) < 30 * 60 * 1000) {
      return events;
    }
  }

  // Parallel data fetch
  const [userDoc, memoryDoc, questsSnap] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('userMemory').doc(userId).get(),
    db.collection('dailyQuests')
      .where('userId', '==', userId)
      .where('date', '==', today)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const user   = userDoc.exists   ? userDoc.data()   : {};
  const memory = memoryDoc.exists ? memoryDoc.data() : null;

  // Aggregate quest progress
  let questsDone = 0, questsTotal = 0;
  questsSnap.docs.forEach((d) => {
    questsTotal++;
    if (d.data().completed) questsDone++;
  });

  // Build candidate events
  const candidates = [];

  const tEvent = buildTimeEvent(questsDone, questsTotal);
  if (tEvent) candidates.push(tEvent);

  // Predictive + pressure only in the morning (avoid repeating all day)
  if (nowHour() < 12) {
    candidates.push(...buildPredictiveEvents(memory));
    const pressure = buildAdaptivePressureEvent(memory);
    if (pressure) candidates.push(pressure);
  }

  candidates.push(...buildSpecialEvents(userId, memory));

  const streakEvent = buildStreakMilestoneEvent(user.streakCount || 0);
  if (streakEvent) candidates.push(streakEvent);

  // Fetch stored narrative events (level-up, rank-up, boss kills)
  const narrativeSnap = await db
    .collection('aiNarrativeEvents')
    .doc(userId)
    .collection('events')
    .where('expiresAt', '>=', today)
    .orderBy('expiresAt', 'desc')
    .limit(3)
    .get()
    .catch(() => ({ docs: [] }));

  narrativeSnap.docs.forEach((d) => candidates.push({ ...d.data(), id: d.id }));

  // Deduplicate → sort by priority → cap at 6
  const seen = new Set();
  const events = candidates
    .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    .slice(0, 6);

  await cacheRef.set({ date: today, events, generatedAt: nowISO() }).catch(() => {});

  return events;
}

// ─── Mark Events Seen ─────────────────────────────────────────────────────────

async function markEventsSeen(userId) {
  const cacheRef = db.collection('aiEventCache').doc(userId);
  const cached   = await cacheRef.get().catch(() => null);
  if (!cached?.exists) return;
  const events = (cached.data().events || []).map((e) => ({ ...e, seen: true }));
  await cacheRef.update({ events });
}

// ─── Narrative Event Triggers ─────────────────────────────────────────────────
// Called from other routes (quest completion, boss kill, rank up).

async function triggerNarrativeEvent(userId, eventType, payload = {}) {
  const templates = {
    level_up: {
      title: `LEVEL ${payload.level ?? '?'} ACHIEVED`,
      message: 'Power threshold expanded. New hunting grounds are now accessible. Do not waste the upgrade.',
      icon: ICON.TROPHY, priority: PRIORITY.HIGH, tag: 'LEVEL UP',
    },
    rank_up: {
      title: `RANK ${payload.rank ?? '?'} CONFERRED`,
      message: `You have ascended to ${payload.rank ?? '?'}-Rank. The system acknowledges your growth. Stronger threats now await.`,
      icon: ICON.TROPHY, priority: PRIORITY.CRITICAL, tag: 'RANK UP',
    },
    boss_complete: {
      title: 'BOSS TERMINATED',
      message: `${payload.bossName ?? 'Boss quest'} eliminated. Rewards claimed. Brief rest authorized — then report back.`,
      icon: ICON.BOSS, priority: PRIORITY.HIGH, tag: 'BOSS KILL',
    },
    streak_broken: {
      title: 'STREAK BROKEN',
      message: `Chain severed after ${payload.streak ?? '?'} days. Setback registered. Rebuild the streak starting now.`,
      icon: ICON.WARNING, priority: PRIORITY.HIGH, tag: 'ALERT',
    },
  };

  const template = templates[eventType];
  if (!template) return null;

  const event = {
    type: TYPE.NARRATIVE,
    seen: false,
    timestamp: nowISO(),
    expiresAt: tomorrowDateStr(),
    ...template,
  };

  const ref = await db
    .collection('aiNarrativeEvents')
    .doc(userId)
    .collection('events')
    .add(event);

  // Bust cache so the narrative appears immediately
  await db.collection('aiEventCache').doc(userId).delete().catch(() => {});

  return { id: ref.id, ...event };
}

module.exports = { generateSystemEvents, markEventsSeen, triggerNarrativeEvent };
