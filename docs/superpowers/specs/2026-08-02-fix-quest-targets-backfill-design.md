# Backfill Script: Fix Under-Base Daily Quest Targets — Design

Date: 2026-08-02

## Problem

The daily quest difficulty rework (see `2026-08-02-daily-quest-difficulty-rework-design.md`)
raised the difficulty multiplier floor from `0.7` to `1.0`, so targets can no longer scale
below the base (20 reps for push-ups/sit-ups/squats, 5km for running). That fix only applies
to *newly generated* `dailyQuests` docs. Docs already written to Firestore — specifically
today's, which the user is currently looking at and acting on — can still carry
`baseTarget`/`currentTarget`/`difficultyMultiplier` values computed under the old rules (e.g.
a 14-rep or ~3.5km target from the old 0.7x floor).

## Design

### Script location and conventions

New file: `scratch/fix_quest_targets.js`, following this repo's existing `scratch/` script
conventions (see `scratch/dedupe_daily_quests.js`, `scratch/reset_user_progress.js`):

- `const { db } = require('../backend/config/firebase');`
- Dry-run by default; `const APPLY = process.argv.includes('--apply');` gates real writes.
- Print a plan/diff of every change before writing.
- `main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); })`.
- Batched writes chunked at 450 per batch (Firestore's cap is 500).

### Scope

- Query `dailyQuests` where `date == todayStr()` and `completed === false`. Already-completed
  docs are skipped entirely and never touched — their target fields, `completed` status, and
  XP already paid out are left exactly as they are.
- Historical past-day `dailyQuests` docs are out of scope — this only fixes today's/currently
  active docs.
- The `quests` collection (templates) is out of scope — `DEFAULT_QUESTS` in
  `backend/services/questService.js` already defines the correct base values (20/20/20/5),
  unchanged by the difficulty rework, and there's no evidence template docs themselves are
  wrong.

### Recompute logic — reuse production code directly

For the remaining (incomplete, today's) docs:

1. Group by `userId`, collect each user's distinct `questId`s from those docs.
2. Fetch the matching `quests` template docs for those IDs.
3. Call `applyDifficultyScaling(userId, questDocs)` from
   `backend/services/difficultyService.js` — the exact same function
   `generateDailyQuests` calls when creating new docs. No formulas are reimplemented in the
   script, eliminating any risk of drift between the fix and production logic.
4. For each doc, compare its stored `baseTarget`/`currentTarget`/`difficultyMultiplier`
   against what `applyDifficultyScaling` computes right now for that quest. If they differ,
   log the diff (old → new). With `--apply`, update only those three fields on the doc.
5. Never modify `completed`, `currentValue`, `userId`, `questId`, or `date` on any doc.

### Output

Dry-run output for each changed doc: `<questId> (user <userId>): baseTarget <old>→<new>,
currentTarget <old>→<new>, multiplier <old>→<new>`. A summary count of docs scanned, docs
needing a fix, and (in `--apply` mode) docs actually updated.

## Testing

This is a one-off operational script, not part of the application's test suite. Verification
is via dry-run inspection (default mode) before ever passing `--apply`, consistent with how
the existing `scratch/` scripts are used in this repo (no dedicated Jest coverage for any of
them).
