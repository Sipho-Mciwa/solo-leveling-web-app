// One-off backfill: the difficulty rework (see
// docs/superpowers/specs/2026-08-02-daily-quest-difficulty-rework-design.md)
// raised the difficulty multiplier floor from 0.7x to 1.0x, so targets can
// no longer scale below the base (20 reps for push-ups/sit-ups/squats, 5km
// for running). That fix only applies to newly generated `dailyQuests`
// docs — it doesn't retroactively correct docs already written to
// Firestore under the old rules (e.g. a 14-rep or ~3.5km target from the
// old 0.7x floor).
//
// This script recomputes baseTarget/currentTarget/difficultyMultiplier for
// today's still-incomplete dailyQuests docs, by calling the real
// applyDifficultyScaling (same function generateDailyQuests uses when
// creating new docs) — no formulas are reimplemented here, so there's no
// risk of drift from production logic.
//
// Already-completed docs are skipped entirely and never touched (their
// target fields, completed status, and any XP already paid out stay
// exactly as they are). Historical past-day docs and the `quests` template
// collection are out of scope.
//
// Defaults to a dry run (prints what it would change). Pass --apply to
// actually write.
//
// Usage:
//   node scratch/fix_quest_targets.js            # dry run
//   node scratch/fix_quest_targets.js --apply     # actually apply

const { db } = require('../backend/config/firebase');
const { applyDifficultyScaling } = require('../backend/services/difficultyService');

const APPLY = process.argv.includes('--apply');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function planFixes() {
  const today = todayStr();

  const dqSnap = await db
    .collection('dailyQuests')
    .where('date', '==', today)
    .where('completed', '==', false)
    .get();

  if (dqSnap.empty) {
    return { fixes: [], scanned: 0 };
  }

  // Group incomplete docs by userId so we can call applyDifficultyScaling
  // once per user, with exactly the quest templates their docs reference.
  const docsByUser = new Map();
  for (const doc of dqSnap.docs) {
    const userId = doc.data().userId;
    if (!docsByUser.has(userId)) docsByUser.set(userId, []);
    docsByUser.get(userId).push(doc);
  }

  const fixes = [];
  for (const [userId, docs] of docsByUser) {
    const questIds = [...new Set(docs.map((d) => d.data().questId))];
    const questSnaps = await Promise.all(
      questIds.map((id) => db.collection('quests').doc(id).get())
    );
    const questDocs = questSnaps.filter((s) => s.exists);

    const scaled = await applyDifficultyScaling(userId, questDocs);
    const scaledByQuestId = Object.fromEntries(scaled.map((s) => [s.questId, s]));

    for (const doc of docs) {
      const d = doc.data();
      const correct = scaledByQuestId[d.questId];
      if (!correct) continue; // template no longer exists — nothing to recompute against

      const needsFix =
        d.baseTarget !== correct.baseTarget ||
        d.currentTarget !== correct.currentTarget ||
        d.difficultyMultiplier !== correct.difficultyMultiplier;

      if (needsFix) {
        fixes.push({ doc, userId, questId: d.questId, from: d, to: correct });
      }
    }
  }

  return { fixes, scanned: dqSnap.size };
}

async function main() {
  console.log(`Scanning today's incomplete dailyQuests docs${APPLY ? ' (APPLY MODE — will write)' : ' (dry run)'}\n`);

  const { fixes, scanned } = await planFixes();
  console.log(`Scanned ${scanned} incomplete doc(s) for today.`);
  console.log(`Docs needing a fix: ${fixes.length}\n`);

  for (const fix of fixes) {
    console.log(
      `${fix.questId} (user ${fix.userId}): ` +
      `baseTarget ${fix.from.baseTarget}->${fix.to.baseTarget}, ` +
      `currentTarget ${fix.from.currentTarget}->${fix.to.currentTarget}, ` +
      `multiplier ${fix.from.difficultyMultiplier}->${fix.to.difficultyMultiplier}`
    );
  }

  if (fixes.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry run only — rerun with --apply to write these changes.');
    return;
  }

  for (let i = 0; i < fixes.length; i += 450) {
    const batch = db.batch();
    for (const fix of fixes.slice(i, i + 450)) {
      batch.update(fix.doc.ref, {
        baseTarget: fix.to.baseTarget,
        currentTarget: fix.to.currentTarget,
        difficultyMultiplier: fix.to.difficultyMultiplier,
      });
    }
    await batch.commit();
  }

  console.log(`\nUpdated ${fixes.length} dailyQuests doc(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
