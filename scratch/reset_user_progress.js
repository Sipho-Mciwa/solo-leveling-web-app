// One-off: reset Sipho's account back to a fresh start. Scoped strictly to
// this one userId — the other account (kamohelomciwa@gmail.com) and the
// shared `quests` template collection are never touched.
//
// Resets the user doc to level 1 / XP 0 / rank E / streak 0 / default title,
// while preserving the real personal fields set earlier (name, DOB, sex,
// height, weight). Also drops the stale stravaTokens/lastStravaSync fields
// left over from the removed Strava integration (flagged separately
// earlier — this is where we're actually cleaning that up).
//
// Deletes every per-user progress doc: dailyQuests, dailyChallenges,
// penaltyQuests, weekendBossChallenges, the legacy bossQuests collection,
// workouts, userMemory, aiCache, aiEventCache, and the aiNarrativeEvents
// subcollection.
//
// Usage:
//   node scratch/reset_user_progress.js            # dry run
//   node scratch/reset_user_progress.js --apply     # actually delete/reset

const { db } = require('../backend/config/firebase');

const APPLY = process.argv.includes('--apply');
const USER_ID = 'Ng82vlN0bIMVIXdg9DIuH98NzJy2'; // siphomciwa@gmail.com

const PRESERVED_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'sex', 'height', 'weight', 'email'];

const PER_USER_COLLECTIONS = [
  'dailyQuests',
  'dailyChallenges',
  'penaltyQuests',
  'weekendBossChallenges',
  'bossQuests', // legacy, still read by titleService for historical title counts
  'workouts',
];

const SINGLETON_DOCS = ['userMemory', 'aiCache', 'aiEventCache'];

async function main() {
  console.log(`Resetting user ${USER_ID}${APPLY ? ' (APPLY MODE — will delete/write)' : ' (dry run)'}\n`);

  const userRef = db.collection('users').doc(USER_ID);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    console.error('User doc not found — aborting.');
    process.exit(1);
  }
  const current = userSnap.data();

  const freshUser = { xp: 0, level: 1, streakCount: 0, lastActiveDate: null, rank: 'E', titles: ['E Rank Hunter'], activeTitle: 'E Rank Hunter' };
  for (const field of PRESERVED_FIELDS) {
    if (current[field] !== undefined) freshUser[field] = current[field];
  }

  const droppedFields = Object.keys(current).filter((k) => !(k in freshUser));
  console.log('User doc reset to:');
  console.log(JSON.stringify(freshUser, null, 2));
  console.log(`\nFields dropped from the old doc: ${droppedFields.join(', ') || '(none)'}`);

  const toDelete = [];

  for (const collection of PER_USER_COLLECTIONS) {
    const snap = await db.collection(collection).where('userId', '==', USER_ID).get();
    console.log(`\n[${collection}] ${snap.size} docs to delete`);
    toDelete.push(...snap.docs);
  }

  for (const docName of SINGLETON_DOCS) {
    const snap = await db.collection(docName).doc(USER_ID).get();
    if (snap.exists) {
      console.log(`[${docName}/${USER_ID}] 1 doc to delete`);
      toDelete.push(snap);
    }
  }

  const narrativeEventsSnap = await db.collection('aiNarrativeEvents').doc(USER_ID).collection('events').get();
  console.log(`[aiNarrativeEvents/${USER_ID}/events] ${narrativeEventsSnap.size} docs to delete`);
  toDelete.push(...narrativeEventsSnap.docs);

  console.log(`\nTotal docs to delete: ${toDelete.length}`);

  if (!APPLY) {
    console.log('\nDry run only — rerun with --apply to write these changes.');
    return;
  }

  // Firestore batches cap at 500 writes; chunk defensively even though this
  // account's history is well under that.
  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = db.batch();
    for (const doc of toDelete.slice(i, i + 450)) batch.delete(doc.ref);
    await batch.commit();
  }

  await userRef.set(freshUser);

  console.log(`\nDeleted ${toDelete.length} docs and reset the user doc.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
