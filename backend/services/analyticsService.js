const { db } = require('../config/firebase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function generateDateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Core data fetch ──────────────────────────────────────────────────────────

async function fetchLast30Days(userId) {
  const startDate = nDaysAgo(29);
  const endDate = todayStr();

  const snapshot = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  return {
    docs: snapshot.docs.map((d) => d.data()),
    startDate,
    endDate,
  };
}

function groupByDate(docs) {
  const byDate = {};
  for (const dq of docs) {
    if (!byDate[dq.date]) byDate[dq.date] = { total: 0, completed: 0 };
    byDate[dq.date].total++;
    if (dq.completed) byDate[dq.date].completed++;
  }
  return byDate;
}

// ─── Insights engine ──────────────────────────────────────────────────────────

function generateInsights(overallRate, activeDailyRates, questStats) {
  const insights = [];

  if (activeDailyRates.length === 0) {
    return [{ type: 'info', title: 'No data yet', text: 'Complete some quests to start seeing insights.' }];
  }

  // Overall performance
  if (overallRate >= 80) {
    insights.push({ type: 'success', title: 'Elite consistency', text: `${overallRate}% average completion. You're performing at the top tier.` });
  } else if (overallRate >= 50) {
    insights.push({ type: 'info', title: 'Good effort', text: `${overallRate}% completion. Push past 80% to unlock elite consistency.` });
  } else {
    insights.push({ type: 'warning', title: 'Low completion', text: `${overallRate}% average. Consider simplifying your daily targets to build momentum.` });
  }

  // Weekly trend (last 7 vs prior 7)
  if (activeDailyRates.length >= 14) {
    const last7 = activeDailyRates.slice(-7).reduce((s, d) => s + d.rate, 0) / 7;
    const prev7 = activeDailyRates.slice(-14, -7).reduce((s, d) => s + d.rate, 0) / 7;
    const delta = last7 - prev7;
    if (delta > 0.1) {
      insights.push({ type: 'success', title: 'Upward trend', text: 'Last 7 days outperform the previous week. Momentum is building.' });
    } else if (delta < -0.1) {
      insights.push({ type: 'warning', title: 'Declining trend', text: 'Last 7 days are weaker than the previous week. Time to refocus.' });
    } else {
      insights.push({ type: 'info', title: 'Steady pace', text: 'Consistent performance across the last two weeks.' });
    }
  }

  // Weakest and strongest quest
  if (questStats.length > 1) {
    const weakest = questStats.reduce((m, q) => q.completionRate < m.completionRate ? q : m, questStats[0]);
    const strongest = questStats.reduce((m, q) => q.completionRate > m.completionRate ? q : m, questStats[0]);

    if (weakest.completionRate < 50) {
      insights.push({ type: 'warning', title: 'Weak link', text: `"${weakest.title}" is your hardest quest at ${weakest.completionRate}% completion.` });
    }
    if (strongest.completionRate >= 80 && strongest.questId !== weakest.questId) {
      insights.push({ type: 'success', title: 'Strongest habit', text: `"${strongest.title}" is your most consistent quest at ${strongest.completionRate}%.` });
    }
  }

  return insights;
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getOverview(userId) {
  const { docs, startDate, endDate } = await fetchLast30Days(userId);
  const byDate = groupByDate(docs);
  const allDates = generateDateRange(startDate, endDate);

  const dailyRates = allDates.map((date) => {
    const data = byDate[date];
    return { date, rate: data ? data.completed / data.total : null };
  });

  const activeDays = dailyRates.filter((d) => d.rate !== null);
  const overallRate =
    activeDays.length > 0
      ? Math.round((activeDays.reduce((s, d) => s + d.rate, 0) / activeDays.length) * 100)
      : 0;

  // Weekly averages (4 × 7-day buckets)
  const buckets = [[], [], [], []];
  allDates.forEach((date, i) => {
    const data = byDate[date];
    if (data) buckets[Math.min(Math.floor(i / 7), 3)].push(data.completed / data.total);
  });
  const weeklyAverages = buckets.map((rates, i) => ({
    week: `Week ${i + 1}`,
    rate: rates.length > 0 ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 100) : 0,
  }));

  // Quest stats for insights (lightweight — no extra Firestore read)
  const byQuestId = {};
  for (const dq of docs) {
    if (!byQuestId[dq.questId]) byQuestId[dq.questId] = { total: 0, completed: 0, questId: dq.questId };
    byQuestId[dq.questId].total++;
    if (dq.completed) byQuestId[dq.questId].completed++;
  }

  // Fetch quest titles for insights
  const questIds = Object.keys(byQuestId);
  const questSnaps = questIds.length
    ? await Promise.all(questIds.map((id) => db.collection('quests').doc(id).get()))
    : [];

  const questStats = questSnaps
    .filter((s) => s.exists)
    .map((s) => {
      const { total, completed } = byQuestId[s.id];
      return {
        questId: s.id,
        title: s.data().title,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

  const insights = generateInsights(overallRate, activeDays, questStats);

  return {
    activeDays: activeDays.length,
    overallCompletionRate: overallRate,
    dailyRates,
    weeklyAverages,
    insights,
  };
}

async function getQuestBreakdown(userId) {
  const { docs } = await fetchLast30Days(userId);

  const byQuestId = {};
  for (const dq of docs) {
    if (!byQuestId[dq.questId]) byQuestId[dq.questId] = { total: 0, completed: 0 };
    byQuestId[dq.questId].total++;
    if (dq.completed) byQuestId[dq.questId].completed++;
  }

  const questIds = Object.keys(byQuestId);
  if (questIds.length === 0) return { quests: [] };

  const questSnaps = await Promise.all(questIds.map((id) => db.collection('quests').doc(id).get()));

  const quests = questSnaps
    .filter((s) => s.exists)
    .map((s) => {
      const { total, completed } = byQuestId[s.id];
      return {
        questId: s.id,
        title: s.data().title,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completedDays: completed,
        totalDays: total,
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);

  return { quests };
}

async function getHeatmap(userId) {
  const { docs, startDate, endDate } = await fetchLast30Days(userId);
  const byDate = groupByDate(docs);
  const allDates = generateDateRange(startDate, endDate);

  const data = allDates.map((date) => ({
    date,
    total: byDate[date]?.total ?? 0,
    completed: byDate[date]?.completed ?? 0,
  }));

  return { data };
}

module.exports = { getOverview, getQuestBreakdown, getHeatmap };
