const { db } = require('../config/firebase');
const { updateQuestProgress } = require('./questService');

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL   = 'https://www.strava.com/api/v3';
const RUNNING_QUEST_ID = 'default_running';

async function getStravaTokens(userId) {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) throw new Error('User not found');
  const tokens = userSnap.data().stravaTokens;
  if (!tokens?.accessToken) throw new Error('Strava not connected');
  return tokens;
}

async function refreshTokenIfNeeded(userId, tokens) {
  // Refresh if less than 5 minutes left
  if (Date.now() / 1000 < tokens.expiresAt - 300) return tokens;

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Strava token');

  const data = await res.json();
  const fresh = {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
  };
  await db.collection('users').doc(userId).update({ stravaTokens: fresh });
  return fresh;
}

async function fetchActivities(userId) {
  let tokens = await getStravaTokens(userId);
  tokens = await refreshTokenIfNeeded(userId, tokens);

  const res = await fetch(`${STRAVA_API_URL}/athlete/activities?per_page=30`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Strava activities');
  return res.json();
}

function filterRuns(activities) {
  return activities.filter((a) => a.type === 'Run');
}

async function processNewActivities(userId, runs) {
  if (!runs.length) return { processed: 0, results: [] };

  // Load already-processed IDs to skip duplicates
  const processedSnap = await db
    .collection('processedActivities')
    .where('userId', '==', userId)
    .get();
  const processedIds = new Set(processedSnap.docs.map((d) => d.data().activityId));

  const newRuns = runs.filter((r) => !processedIds.has(String(r.id)));
  if (!newRuns.length) return { processed: 0, results: [] };

  const results = [];
  for (const run of newRuns) {
    const distanceKm = run.distance / 1000;
    const runDate    = run.start_date_local?.split('T')[0] ?? new Date().toISOString().split('T')[0];

    const questResult = await completeRunningQuest(userId, distanceKm, runDate);

    await db.collection('processedActivities').add({
      userId,
      activityId: String(run.id),
      distance:   run.distance,
      date:       runDate,
    });

    results.push({ activityId: String(run.id), distanceKm, date: runDate, ...questResult });
  }

  return { processed: results.length, results };
}

async function completeRunningQuest(userId, distanceKm, date) {
  const dqSnap = await db
    .collection('dailyQuests')
    .where('userId',   '==', userId)
    .where('date',     '==', date)
    .where('questId',  '==', RUNNING_QUEST_ID)
    .limit(1)
    .get();

  if (dqSnap.empty) return { questFound: false };

  const dqDoc = dqSnap.docs[0];
  const dq    = dqDoc.data();

  if (dq.completed) return { questFound: true, alreadyCompleted: true };

  const target = dq.currentTarget ?? 5;
  if (distanceKm < target) return { questFound: true, belowTarget: true, distanceKm, target };

  const result = await updateQuestProgress(dqDoc.id, userId, distanceKm);
  return {
    questFound: true,
    completed:  result.completed,
    xp:         result.xp,
    bonusXp:    result.bonusXp,
    distanceKm,
    target,
  };
}

// Convenience: fetch → filter → process in one call
async function syncStravaActivities(userId) {
  const activities = await fetchActivities(userId);
  const runs       = filterRuns(activities);
  return processNewActivities(userId, runs);
}

module.exports = {
  fetchActivities,
  filterRuns,
  processNewActivities,
  completeRunningQuest,
  syncStravaActivities,
};
