// One-off cleanup for a real duplicate-quest-template bug found in
// production: the `quests` collection had 24 template docs — 6 duplicate
// copies each of Sit-ups/Push-ups/Squats/Running, only 4 of which were the
// canonical deterministic `default_*` docs (the rest were stray random-ID
// leftovers from before that naming scheme, never cleaned up). Every
// generateDailyQuests call merged templates by doc ID, so all 24
// distinct-ID-but-same-title docs survived and each spawned its own daily
// quest for the same habit, on every day it ran.
//
// Fixed at the code level in questService.js (dedup by title going
// forward). This script cleans up the data debt that already exists:
//   1. Delete the stray duplicate `quests` template docs, keeping the
//      canonical `default_*` doc for each title.
//   2. For every `dailyQuests` doc referencing a stray (about-to-be-deleted)
//      template: if a sibling daily quest for the same user/date/title
//      already points at the canonical template, delete this one; if it's
//      the only copy for that day, repoint its questId to the canonical
//      template instead (preserves any logged progress).
//
// Defaults to a dry run (prints what it would change). Pass --apply to
// actually write.
//
// Usage:
//   node scratch/dedupe_daily_quests.js            # dry run
//   node scratch/dedupe_daily_quests.js --apply     # actually apply

const { db } = require('../backend/config/firebase');

const APPLY = process.argv.includes('--apply');

async function findCanonicalTemplates() {
  const snap = await db.collection('quests').get();

  const byTitle = new Map(); // normalized title -> docs[]
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isCustom) continue; // never touch user-authored custom quests
    const key = (data.title || '').trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(doc);
  }

  const canonicalIdByTitle = new Map();
  const staleTemplateDocs = [];
  for (const [title, docs] of byTitle) {
    if (docs.length <= 1) {
      canonicalIdByTitle.set(title, docs[0].id);
      continue;
    }
    const canonical = docs.find((d) => d.id.startsWith('default_')) || docs[0];
    canonicalIdByTitle.set(title, canonical.id);
    const stale = docs.filter((d) => d.id !== canonical.id);
    console.log(`[quests] "${title}": ${docs.length} template copies -> keeping ${canonical.id}, removing ${stale.length} stray copies: ${stale.map((d) => d.id).join(', ')}`);
    staleTemplateDocs.push(...stale);
  }

  return { canonicalIdByTitle, staleTemplateDocs };
}

async function planDailyQuestFixes(staleTemplateIds, canonicalIdByTitle, titleByTemplateId) {
  const dqSnap = await db.collection('dailyQuests').get();

  // Group every dailyQuests doc by userId+date+title (not just the affected
  // ones) so we can tell, per affected doc, whether a sibling for the same
  // day already points at the canonical template.
  const bucket = new Map();
  for (const doc of dqSnap.docs) {
    const d = doc.data();
    const title = titleByTemplateId.get(d.questId);
    if (!title) continue;
    const key = `${d.userId}_${d.date}_${title}`;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(doc);
  }

  const affected = dqSnap.docs.filter((d) => staleTemplateIds.has(d.data().questId));

  const toDelete = [];
  const toRepoint = [];
  for (const doc of affected) {
    const d = doc.data();
    const title = titleByTemplateId.get(d.questId);
    const canonicalId = canonicalIdByTitle.get(title);
    const key = `${d.userId}_${d.date}_${title}`;
    const siblings = bucket.get(key) || [];
    const hasCanonicalSibling = siblings.some((s) => s.id !== doc.id && s.data().questId === canonicalId);

    if (hasCanonicalSibling) {
      toDelete.push(doc);
    } else {
      toRepoint.push({ doc, canonicalId });
    }
  }

  return { toDelete, toRepoint };
}

function logSample(label, items, describe) {
  console.log(`  -> ${items.length} ${label}`);
  for (const item of items.slice(0, 10)) console.log(`     ${describe(item)}`);
  if (items.length > 10) console.log(`     ... and ${items.length - 10} more`);
}

async function main() {
  console.log(`Scanning quest templates${APPLY ? ' (APPLY MODE — will write)' : ' (dry run)'}\n`);

  const { canonicalIdByTitle, staleTemplateDocs } = await findCanonicalTemplates();
  console.log(`\nTotal stray template docs: ${staleTemplateDocs.length}`);

  if (staleTemplateDocs.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  const staleTemplateIds = new Set(staleTemplateDocs.map((d) => d.id));

  const templateSnap = await db.collection('quests').get();
  const titleByTemplateId = new Map();
  for (const doc of templateSnap.docs) {
    titleByTemplateId.set(doc.id, (doc.data().title || '').trim().toLowerCase());
  }

  const { toDelete, toRepoint } = await planDailyQuestFixes(staleTemplateIds, canonicalIdByTitle, titleByTemplateId);

  console.log(`\nDaily quest docs referencing a stray template: ${toDelete.length + toRepoint.length}`);
  logSample('same-day duplicates of an existing canonical entry (delete)', toDelete,
    (doc) => `delete dailyQuests/${doc.id} (userId=${doc.data().userId}, date=${doc.data().date})`);
  logSample('only copy for that day (repoint questId to canonical, keep progress)', toRepoint,
    ({ doc, canonicalId }) => `repoint dailyQuests/${doc.id} (userId=${doc.data().userId}, date=${doc.data().date}) -> questId=${canonicalId}`);

  if (!APPLY) {
    console.log('\nDry run only — rerun with --apply to write these changes.');
    return;
  }

  const batch = db.batch();
  for (const doc of toDelete) batch.delete(doc.ref);
  for (const { doc, canonicalId } of toRepoint) batch.update(doc.ref, { questId: canonicalId });
  for (const doc of staleTemplateDocs) batch.delete(doc.ref);
  await batch.commit();

  console.log(`\nDeleted ${toDelete.length} duplicate dailyQuests docs.`);
  console.log(`Repointed ${toRepoint.length} dailyQuests docs to their canonical template.`);
  console.log(`Deleted ${staleTemplateDocs.length} stray quest template docs.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
