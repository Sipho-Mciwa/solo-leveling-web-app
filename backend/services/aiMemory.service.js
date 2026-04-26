const { db } = require('../config/firebase');
const { VOICE_INSTRUCTION, FALLBACKS } = require('./systemVoice');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Returns the Monday of the current ISO week (YYYY-MM-DD)
function currentWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// ─── Pattern detection ────────────────────────────────────────────────────────

/**
 * Given 30 days of dailyQuest docs, returns the day-of-week with the lowest
 * completion rate (the "drop-off" day). Returns null if insufficient data.
 */
function detectDropOff(questDocs) {
  // buckets[dayIndex] = { total, completed }
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, completed: 0 }));

  for (const doc of questDocs) {
    if (!doc.date) continue;
    const dayIndex = new Date(doc.date + 'T12:00:00').getDay();
    buckets[dayIndex].total++;
    if (doc.completed) buckets[dayIndex].completed++;
  }

  // Only consider days that have at least 3 data points
  const qualified = buckets
    .map((b, i) => ({ dayIndex: i, ...b }))
    .filter((b) => b.total >= 3);

  if (qualified.length === 0) return { dayIndex: null, dayLabel: null };

  const worst = qualified.reduce((a, b) => {
    const rateA = a.completed / a.total;
    const rateB = b.completed / b.total;
    return rateA <= rateB ? a : b;
  });

  return {
    dayIndex: worst.dayIndex,
    dayLabel: DAY_LABELS[worst.dayIndex],
    completionRate: Math.round((worst.completed / worst.total) * 100),
  };
}

/**
 * Given 30 days of dailyChallenge docs, returns the challenge key/title that
 * was left incomplete most often.
 */
function findMostMissedHabit(challengeDocs) {
  const missCount = {}; // key → { title, misses, total }

  for (const doc of challengeDocs) {
    if (!Array.isArray(doc.challenges)) continue;
    for (const c of doc.challenges) {
      if (!missCount[c.key]) {
        missCount[c.key] = { title: c.title, misses: 0, total: 0 };
      }
      missCount[c.key].total++;
      if (!c.completed) missCount[c.key].misses++;
    }
  }

  const entries = Object.entries(missCount).filter(([, v]) => v.total >= 5);
  if (entries.length === 0) return { key: null, title: null, missRate: null };

  const [key, data] = entries.reduce((a, b) => {
    return a[1].misses / a[1].total >= b[1].misses / b[1].total ? a : b;
  });

  return {
    key,
    title: data.title,
    missRate: Math.round((data.misses / data.total) * 100),
  };
}

/**
 * Compares recent vs older completion rates and returns a trend label.
 */
function computeTrend(recentRate, olderRate) {
  if (olderRate === null || olderRate === undefined) return 'stable';
  const diff = recentRate - olderRate;
  if (diff >= 10) return 'improving';
  if (diff <= -10) return 'declining';
  return 'stable';
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchQuestDocs(userId, days) {
  const snap = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '>=', nDaysAgo(days - 1))
    .where('date', '<=', todayStr())
    .get();
  return snap.docs.map((d) => d.data());
}

async function fetchChallengeDocs(userId, days) {
  const snap = await db
    .collection('dailyChallenges')
    .where('userId', '==', userId)
    .where('date', '>=', nDaysAgo(days - 1))
    .where('date', '<=', todayStr())
    .get();
  return snap.docs.map((d) => d.data());
}

function completionRate(docs) {
  if (docs.length === 0) return null;
  const completed = docs.filter((d) => d.completed).length;
  return Math.round((completed / docs.length) * 100);
}

// ─── Weekly summary (AI) ──────────────────────────────────────────────────────

async function callAI(prompt) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      console.error('[AIMemory] Gemini failed:', e.message);
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.7,
      });
      return completion.choices[0].message.content.trim();
    } catch (e) {
      console.error('[AIMemory] Groq failed:', e.message);
    }
  }
  return null;
}

function buildWeeklySummaryPrompt(userSnap, memory, last7Rate, last30Rate) {
  const user    = userSnap.exists ? userSnap.data() : {};
  const missed  = memory.patterns?.mostMissedHabitTitle  || 'unrecorded';
  const dropOff = memory.patterns?.dropOffDayLabel        || 'unidentified';
  const trend   = memory.trends?.questCompletion          || 'stable';

  return `${VOICE_INSTRUCTION}

Hunter weekly data:
- Rank: ${user.rank || 'E'}, Level: ${user.level || 1}
- Active streak: ${user.streakCount || 0} days
- 7-day completion: ${last7Rate ?? 'unrecorded'}%
- 30-day completion: ${last30Rate ?? 'unrecorded'}%
- Performance trend: ${trend}
- Highest-miss protocol: ${missed}
- Lowest output day: ${dropOff}
- Peak streak on record: ${memory.streakHistory?.longestStreak || 0} days

Generate a 2-sentence weekly performance evaluation. Identify what output was acceptable and what requires correction. Reference specific metrics.`;
}

// ─── Core: updateMemory ───────────────────────────────────────────────────────

async function updateMemory(userId) {
  const [userSnap, quests30, challenges30] = await Promise.all([
    db.collection('users').doc(userId).get(),
    fetchQuestDocs(userId, 30),
    fetchChallengeDocs(userId, 30),
  ]);

  const user = userSnap.exists ? userSnap.data() : {};

  // Split quests into two windows for trend
  const cutoff = nDaysAgo(13); // day 14 boundary
  const quests7  = quests30.filter((d) => d.date >= nDaysAgo(6));
  const quests14 = quests30.filter((d) => d.date >= cutoff && d.date < nDaysAgo(6));

  const rate7  = completionRate(quests7);
  const rate14 = completionRate(quests14);
  const rate30 = completionRate(quests30);

  // Pattern detection
  const dropOff = detectDropOff(quests30);
  const missedHabit = findMostMissedHabit(challenges30);
  const trend = computeTrend(rate7 ?? 0, rate14 ?? 0);

  // Streak history — longest streak from user doc (updated live) vs personal best
  const currentStreak = user.streakCount || 0;
  const existingMemorySnap = await db.collection('userMemory').doc(userId).get();
  const existingMemory = existingMemorySnap.exists ? existingMemorySnap.data() : {};
  const longestStreak = Math.max(
    currentStreak,
    existingMemory.streakHistory?.longestStreak || 0
  );

  // Count streak breaks in last 30 days: days with quests but 0 completed
  const byDate = {};
  for (const q of quests30) {
    if (!byDate[q.date]) byDate[q.date] = { total: 0, completed: 0 };
    byDate[q.date].total++;
    if (q.completed) byDate[q.date].completed++;
  }
  const streakBreaks = Object.values(byDate).filter(
    (d) => d.total > 0 && d.completed === 0
  ).length;

  const memory = {
    updatedAt: todayStr(),
    trends: {
      questCompletion: trend,
    },
    patterns: {
      mostMissedHabit: missedHabit.key,
      mostMissedHabitTitle: missedHabit.title,
      mostMissedHabitMissRate: missedHabit.missRate,
      dropOffDayIndex: dropOff.dayIndex,
      dropOffDayLabel: dropOff.dayLabel,
      dropOffDayCompletionRate: dropOff.completionRate ?? null,
      avgCompletionLast7: rate7,
      avgCompletionLast14: rate14,
      avgCompletionLast30: rate30,
    },
    streakHistory: {
      longestStreak,
      currentStreak,
      streakBreaks,
    },
    // Preserve existing weekly summary unless we're regenerating it
    weeklySummary: existingMemory.weeklySummary || null,
  };

  await db.collection('userMemory').doc(userId).set(memory);

  // Invalidate today's AI insight cache so next request uses fresh memory
  try {
    const cacheSnap = await db.collection('aiCache').doc(userId).get();
    if (cacheSnap.exists && cacheSnap.data().date === todayStr()) {
      await db.collection('aiCache').doc(userId).update({ insight: null });
    }
  } catch {
    // Non-critical
  }

  console.log(`[AIMemory] Updated memory for ${userId} — trend: ${trend}, streak breaks: ${streakBreaks}`);
  return memory;
}

// ─── Core: getMemory ──────────────────────────────────────────────────────────

async function getMemory(userId) {
  const snap = await db.collection('userMemory').doc(userId).get();
  if (!snap.exists) return null;
  return snap.data();
}

// ─── Core: generateWeeklySummary ─────────────────────────────────────────────

async function generateWeeklySummary(userId) {
  const weekStart = currentWeekStart();

  // Check if summary already exists for this week
  const snap = await db.collection('userMemory').doc(userId).get();
  const existing = snap.exists ? snap.data() : {};
  if (existing.weeklySummary?.generatedAt === weekStart) {
    return existing.weeklySummary.text;
  }

  // Ensure memory is fresh enough (updated today or yesterday)
  let memory = existing;
  if (!memory.updatedAt || memory.updatedAt < nDaysAgo(1)) {
    memory = await updateMemory(userId);
  }

  const [userSnap, quests7, quests30] = await Promise.all([
    db.collection('users').doc(userId).get(),
    fetchQuestDocs(userId, 7),
    fetchQuestDocs(userId, 30),
  ]);

  const prompt = buildWeeklySummaryPrompt(
    userSnap,
    memory,
    completionRate(quests7),
    completionRate(quests30)
  );

  const DEFAULT_SUMMARY = FALLBACKS.weeklySummary;

  const text = (await callAI(prompt)) || DEFAULT_SUMMARY;

  const weeklySummary = { generatedAt: weekStart, text };
  await db.collection('userMemory').doc(userId).update({ weeklySummary });

  return text;
}

module.exports = {
  updateMemory,
  getMemory,
  generateWeeklySummary,
  detectDropOff,
  findMostMissedHabit,
};
