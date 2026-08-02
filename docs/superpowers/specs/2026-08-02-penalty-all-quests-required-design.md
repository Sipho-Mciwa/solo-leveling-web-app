# Penalty: Require All Daily Quests Completed — Design

Date: 2026-08-02

## Problem

`backend/services/penaltyService.js`'s `generatePenalty()` decides whether a user missed a
day using only `user.lastActiveDate`:

```js
if (!user.lastActiveDate || user.lastActiveDate >= yesterday) {
  return { generated: false, message: 'No missed days' };
}
```

But `lastActiveDate` is bumped to today the moment **any single** daily quest is completed
(`backend/services/questService.js:233`, inside `updateQuestProgress` → `computeStreakUpdate`),
regardless of how many other quests exist that day or whether they were done. So a user who
completes 1 of 4 daily quests looks, to the penalty engine, identical to a user who completed
all 4 — no penalty fires either way. The user wants: a penalty must fire unless **all** daily
quests for that day were completed.

## Design

### New helper: `wereAllQuestsCompleted`

Add to `backend/services/questService.js` (which already owns all `dailyQuests`-collection
logic):

```js
async function wereAllQuestsCompleted(userId, date) {
  const snap = await db
    .collection('dailyQuests')
    .where('userId', '==', userId)
    .where('date', '==', date)
    .get();

  if (snap.empty) return false; // no quests generated that day = not completed
  return snap.docs.every((d) => d.data().completed === true);
}
```

- Returns `true` only if the day has at least one `dailyQuests` doc and every doc has
  `completed === true`.
- An empty snapshot (the user never opened the app that day, so `generateDailyQuests` never
  ran) returns `false` — counts as a fully missed day, per the answer that no-login days
  should still trigger a penalty.
- "All daily quests" means every doc generated for that user that day — default quests
  (push-ups/sit-ups/squats/running) and any custom quests the user has added, per the answer
  that custom quests count too. No filtering by `isCustom` — the query already scopes to
  that user's `dailyQuests` for that date, which is exactly the set they were assigned.

### Updated trigger in `generatePenalty`

Replace the `lastActiveDate`-based check with a call to the new helper, keeping the existing
"never been active" guard as-is:

```js
if (!user.lastActiveDate) {
  return { generated: false, message: 'No missed days' };
}

const allCompleted = await wereAllQuestsCompleted(userId, yesterday);
if (allCompleted) {
  return { generated: false, message: 'No missed days' };
}
```

- The `!user.lastActiveDate` guard is unchanged: a user who has never completed any quest
  ever (a genuinely brand-new account) is not retroactively penalized for a "yesterday" that
  predates their signup.
- Once a user has been active at least once, the pass/fail decision for "was yesterday
  missed" comes entirely from `wereAllQuestsCompleted`, not from `lastActiveDate`.
- Everything downstream of this check — stale-penalty expiry (`expireStalePenalty`), today's
  penalty generation (`buildPenaltyData`, the deterministic `${userId}_${today}` doc ID) — is
  unchanged.

### Explicitly out of scope

- `lastActiveDate` / `streakCount` themselves are not modified anywhere. Rank promotion
  (`rankService.js`), titles, and the per-quest difficulty streak (`difficultyService.js`,
  from the prior rework) all keep reading/writing those fields exactly as today — this change
  only affects the boolean decision inside `generatePenalty`.
- The multi-day stale-penalty-expiry loop, XP-deduction amounts (`buildPenaltyData`'s
  `xpPenalty` formula), and the penalty lockout UI are unchanged.
- This only evaluates a single reference day (`yesterday`), matching the existing function's
  scope — it does not introduce per-day evaluation across a multi-day gap. (That limitation
  already exists today and is not part of what was asked.)

## Testing

- Unit tests for `wereAllQuestsCompleted` (new, in `backend/__tests__/questService.test.js` or
  a new file): all quests completed → `true`; one incomplete among several → `false`; no
  `dailyQuests` docs for that date → `false`.
- Tests for `generatePenalty` (new, likely `backend/__tests__/penaltyService.test.js`, which
  does not currently exist):
  - Partial completion yesterday (e.g. 1 of 4 quests done) → penalty generated.
  - Full completion yesterday (all assigned quests, including a custom one) → no penalty.
  - No `dailyQuests` docs at all for yesterday (user never opened the app) → penalty
    generated.
  - Brand-new user with no `lastActiveDate` ever → no penalty (existing guard preserved).
