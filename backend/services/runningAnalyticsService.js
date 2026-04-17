const { db } = require('../config/firebase');

// ─── Simple 5-min in-memory cache ─────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(userId) {
  const entry = _cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(userId); return null; }
  return entry.data;
}

function setCache(userId, data) {
  _cache.set(userId, { data, ts: Date.now() });
}

function invalidateCache(userId) {
  _cache.delete(userId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Returns the Monday of the ISO week that contains dateStr
function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7; // Mon=1 … Sun=7
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().split('T')[0];
}

function weekLabel(mondayDateStr) {
  const d = new Date(mondayDateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// pace in min/km (returns null if no time data)
function computePace(distanceMeters, movingTimeSecs) {
  if (!movingTimeSecs || !distanceMeters) return null;
  const distanceKm = distanceMeters / 1000;
  return movingTimeSecs / distanceKm / 60;
}

// Format raw decimal min/km → "5:24 /km"
function formatPace(paceMinKm) {
  if (paceMinKm == null) return null;
  const mins = Math.floor(paceMinKm);
  const secs = Math.round((paceMinKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── Trend insights ───────────────────────────────────────────────────────────

function generateRunningInsights(thisWeek, lastWeek, totalRuns, consistencyScore) {
  const insights = [];

  if (totalRuns === 0) {
    insights.push('No runs recorded yet. Sync your first Strava run to start tracking.');
    return insights;
  }

  // Pace trend
  if (thisWeek && lastWeek && thisWeek.avgPace && lastWeek.avgPace) {
    const paceDelta = lastWeek.avgPace - thisWeek.avgPace; // positive = faster this week
    const pct = Math.abs(Math.round((paceDelta / lastWeek.avgPace) * 100));
    if (pct >= 3) {
      insights.push(
        paceDelta > 0
          ? `Your pace improved by ${pct}% this week. You're running faster.`
          : `Your pace slowed by ${pct}% this week. Fatigue or recovery day?`
      );
    }
  }

  // Distance trend
  if (thisWeek && lastWeek) {
    const distDelta = thisWeek.totalDistance - lastWeek.totalDistance;
    if (Math.abs(distDelta) >= 1) {
      insights.push(
        distDelta > 0
          ? `You ran ${distDelta.toFixed(1)} km more than last week. Good volume.`
          : `Your distance dropped by ${Math.abs(distDelta).toFixed(1)} km vs last week. Stay consistent.`
      );
    }
  }

  // Consistency
  if (consistencyScore >= 75) {
    insights.push('Strong consistency — you\'ve been running every week.');
  } else if (consistencyScore <= 25 && totalRuns > 0) {
    insights.push('Inconsistent weeks detected. Aim for at least 1 run per week to build base fitness.');
  }

  // Run frequency this week
  if (thisWeek && thisWeek.runs >= 3) {
    insights.push(`${thisWeek.runs} runs this week. High frequency builds aerobic base fast.`);
  }

  if (insights.length === 0) {
    insights.push('Keep logging runs to unlock pace and distance trend insights.');
  }

  return insights;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function getRunningAnalytics(userId) {
  const cached = getCached(userId);
  if (cached) return cached;

  const startDate = nDaysAgo(29);

  const snap = await db
    .collection('processedActivities')
    .where('userId', '==', userId)
    .where('date',   '>=', startDate)
    .get();

  const rawRuns = snap.docs
    .map((d) => d.data())
    .filter((r) => r.distance > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Per-run pace trend ───────────────────────────────────────────────────
  const paceTrend = rawRuns.map((r) => {
    const pace = computePace(r.distance, r.movingTime);
    return {
      date:        r.date,
      distanceKm:  parseFloat((r.distance / 1000).toFixed(2)),
      pace,
      paceLabel:   formatPace(pace),
    };
  });

  // ── Weekly aggregation ───────────────────────────────────────────────────
  const weekMap = {};
  for (const r of rawRuns) {
    const wk = weekStart(r.date);
    if (!weekMap[wk]) weekMap[wk] = { runs: 0, totalDistance: 0, paces: [] };
    weekMap[wk].runs++;
    weekMap[wk].totalDistance += r.distance / 1000;
    const pace = computePace(r.distance, r.movingTime);
    if (pace) weekMap[wk].paces.push(pace);
  }

  const weeklyData = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, d]) => ({
      week:          weekLabel(wk),
      weekStart:     wk,
      runs:          d.runs,
      totalDistance: parseFloat(d.totalDistance.toFixed(2)),
      avgPace:       d.paces.length ? d.paces.reduce((s, p) => s + p, 0) / d.paces.length : null,
      avgPaceLabel:  d.paces.length ? formatPace(d.paces.reduce((s, p) => s + p, 0) / d.paces.length) : null,
    }));

  // ── Consistency score (weeks with ≥1 run out of last 4) ──────────────────
  const last4Weeks = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    last4Weeks.push(weekStart(d.toISOString().split('T')[0]));
  }
  const weeksWithRuns = last4Weeks.filter((wk) => weekMap[wk]?.runs > 0).length;
  const consistencyScore = Math.round((weeksWithRuns / 4) * 100);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalRuns        = rawRuns.length;
  const totalDistanceKm  = parseFloat(rawRuns.reduce((s, r) => s + r.distance / 1000, 0).toFixed(2));
  const allPaces         = rawRuns.map((r) => computePace(r.distance, r.movingTime)).filter(Boolean);
  const avgPaceMinKm     = allPaces.length ? allPaces.reduce((s, p) => s + p, 0) / allPaces.length : null;

  // ── Insights ─────────────────────────────────────────────────────────────
  const thisWeek = weeklyData[weeklyData.length - 1] ?? null;
  const lastWeek = weeklyData[weeklyData.length - 2] ?? null;
  const insights = generateRunningInsights(thisWeek, lastWeek, totalRuns, consistencyScore);

  const result = {
    weeklyData,
    paceTrend,
    totalRuns,
    totalDistanceKm,
    avgPaceMinKm,
    avgPaceLabel:    formatPace(avgPaceMinKm),
    consistencyScore,
    insights,
  };

  setCache(userId, result);
  return result;
}

module.exports = { getRunningAnalytics, invalidateCache };
