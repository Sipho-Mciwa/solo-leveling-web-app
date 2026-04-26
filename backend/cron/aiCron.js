const cron = require('node-cron');
const { db } = require('../config/firebase');
const { updateMemory } = require('../services/aiMemory.service');

const USER_STAGGER_MS = 1500;

async function runMemoryUpdate() {
  let updated = 0;
  let errors = 0;

  try {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      if (updated + errors > 0) {
        await new Promise((r) => setTimeout(r, USER_STAGGER_MS));
      }

      try {
        await updateMemory(userDoc.id);
        updated++;
      } catch (err) {
        console.error(`[AICron] ${userDoc.id}: ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    console.error('[AICron] Failed to fetch users:', err.message);
  }

  if (updated + errors > 0) {
    console.log(`[AICron] Memory update done — ${updated} updated, ${errors} errors`);
  }
}

function startAICron() {
  // Run daily at 02:00 AM server time
  cron.schedule('0 2 * * *', () => {
    console.log('[AICron] Running daily memory update...');
    runMemoryUpdate();
  });
  console.log('[AICron] Daily memory update scheduled (02:00 AM)');
}

module.exports = { startAICron };
