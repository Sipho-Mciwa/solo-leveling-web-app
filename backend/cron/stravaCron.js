const cron = require('node-cron');
const { db } = require('../config/firebase');
const { syncStravaActivities } = require('../services/stravaSync.service');

// Stagger delay between users to avoid hammering Strava
const USER_STAGGER_MS = 2000;

async function runBackgroundSync() {
  let synced = 0;
  let errors = 0;

  try {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (!data.stravaTokens?.accessToken) continue;

      // Small gap between each user
      if (synced + errors > 0) {
        await new Promise((r) => setTimeout(r, USER_STAGGER_MS));
      }

      try {
        const result = await syncStravaActivities(userDoc.id);
        if (result.skipped) continue;
        if (result.processed > 0) {
          console.log(`[StravaCron] ${userDoc.id}: ${result.processed} new run(s) processed`);
        }
        synced++;
      } catch (err) {
        console.error(`[StravaCron] ${userDoc.id}: ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    console.error('[StravaCron] Failed to fetch users:', err.message);
  }

  if (synced + errors > 0) {
    console.log(`[StravaCron] Done — ${synced} synced, ${errors} errors`);
  }
}

function startStravaCron() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    runBackgroundSync();
  });
  console.log('[StravaCron] Background sync scheduled (every 15 min)');
}

module.exports = { startStravaCron };
