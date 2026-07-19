const cron = require('node-cron');
const { db } = require('../config/firebase');
const { updateMemory } = require('../services/aiMemory.service');
const { logger } = require('../utils/logger');

const USER_STAGGER_MS = 1500;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function updateMemoryWithRetry(userId) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await updateMemory(userId);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
    }
  }
  throw lastErr;
}

async function runMemoryUpdate() {
  let updated = 0;
  let errors = 0;
  let total = 0;

  try {
    const usersSnap = await db.collection('users').get();
    total = usersSnap.docs.length;

    for (const userDoc of usersSnap.docs) {
      if (updated + errors > 0) {
        await sleep(USER_STAGGER_MS);
      }

      try {
        await updateMemoryWithRetry(userDoc.id);
        updated++;
      } catch (err) {
        logger.error({ err, userId: userDoc.id }, '[AICron] memory update failed after retries');
        errors++;
      }
    }
  } catch (err) {
    logger.error({ err }, '[AICron] Failed to fetch users');
  }

  if (updated + errors > 0) {
    logger.info({ updated, errors, total }, '[AICron] Memory update done');
  }

  // A fully-failed run (every user errored) usually means a systemic issue
  // (provider outage, revoked API key) rather than per-user flukes — surface
  // it at a higher severity so it's easy to alert on even without an external
  // alerting integration wired up yet.
  if (total > 0 && errors === total) {
    logger.fatal({ total }, '[AICron] Daily memory update failed for every user — likely a provider/config outage');
  }
}

function startAICron() {
  // Run daily at 02:00 AM server time
  cron.schedule('0 2 * * *', () => {
    logger.info('[AICron] Running daily memory update...');
    runMemoryUpdate();
  });
  logger.info('[AICron] Daily memory update scheduled (02:00 AM)');
}

module.exports = { startAICron };
