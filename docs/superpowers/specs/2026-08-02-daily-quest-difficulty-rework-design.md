# Daily Quest Difficulty Rework — Design

Date: 2026-08-02

## Problem

Daily quest targets for the four fixed exercises (Push-ups, Sit-ups, Squats, Running) scale
via a difficulty multiplier computed in `backend/services/difficultyService.js`. Two issues:

1. **Targets spike after a single completion.** `calculatePerformance` looks at a 7-day
   trailing window of `dailyQuests` docs and computes a completion *rate*. With only one day
   of history, that rate is 100%, which drives the multiplier straight to its max (1.5x) —
   there's no real "consistency" being measured, just whatever happened yesterday.
2. **Targets can drop below the intended base.** `MULTIPLIER_MIN` is `0.7`, so
   underperformance can shrink push-ups/sit-ups/squats to 14 reps and running to ~4km —
   below what should be the floor.

Base targets themselves (Push-ups/Sit-ups/Squats = 20 reps, Running = 5km, defined in
`backend/services/questService.js`'s `DEFAULT_QUESTS`) are already correct and unchanged by
this work.

## Design

### Floor and cap

- `MULTIPLIER_MIN` changes from `0.7` to `1.0`. Targets never go below the base value —
  underperformance simply keeps the target at base, it does not reduce it further.
- `MULTIPLIER_MAX` stays `1.5`.

### Consistency model: per-quest consecutive-day streak

Replace the 7-day completion-*rate* model (`calculatePerformance` /
`calculateDifficultyMultiplier`'s `performanceScore` input) with a per-quest **consecutive
completed-day streak**, computed independently for each of the four quests:

- Starting from yesterday and walking backward one day at a time, count consecutive days
  where that quest's `dailyQuests` doc exists and `completed === true`.
- Stop counting at the first day that has no doc for that quest, or has `completed: false`.
- Bound the lookback query to 60 days (more than enough to reach the 1.5x cap; avoids an
  unbounded Firestore query).

**Qualifying day:** a day counts toward the streak if the quest was marked complete that day
(the existing `completed` flag set via the Complete button flow) — meeting or exceeding
`currentTarget` is not required.

**Missed day:** any day without a completion breaks the streak at that point. Because the
streak is recomputed by walking back from yesterday each time targets are generated, a
missed day naturally resets that quest's multiplier to `1.0` (base) — no separate
`missedDays >= 2` special case is needed; the old hard-reset behavior in
`calculateDifficultyMultiplier` is removed entirely.

### Growth formula

```
multiplier = 1 + floor(streak / 3) * 0.05
multiplier = clamp(multiplier, 1.0, 1.5)
```

Same step size as today's existing momentum bonus (+5% per 3-day increment), but it is now
the *only* driver of the multiplier — there is no longer a separate performance-rate term
that can jump the multiplier on day one. Reaching the 1.5x cap requires a 30-day unbroken
per-quest streak.

### API / call-site changes

- `calculatePerformance` is removed.
- `calculateDifficultyMultiplier(performanceScore, streakCount, missedDays)` is replaced by
  a function taking the per-quest streak count directly, e.g.
  `calculateDifficultyMultiplier(streak)`.
- A new helper computes per-quest streaks from `dailyQuests` history (replacing
  `calculatePerformance`'s role), e.g. `calculatePerQuestStreaks(userId, questIds)` returning
  `{ questId → streak }`.
- `applyDifficultyScaling(userId, questDocs, streakCount, lastActiveDate)` drops the
  `streakCount` and `lastActiveDate` parameters — its new signature is
  `applyDifficultyScaling(userId, questDocs)`. The global user-level `streakCount` /
  `lastActiveDate` fields are untouched and continue to power rank promotion
  (`rankService.js`) and titles elsewhere; this change only affects what feeds the
  quest-difficulty multiplier.
- In `backend/services/questService.js`'s `generateDailyQuests`, the `userSnap`/`userData`
  fetch (used only to supply the two now-removed args) is deleted along with the updated
  call to `applyDifficultyScaling`.

### Out of scope

- Base target values (already correct).
- Global `streakCount`/rank/title logic (untouched, still reads the user-level streak
  fields).
- Overperformance bonus XP logic at completion time (unrelated to target scaling).

## Testing

- Unit tests for `difficultyService.js` covering: streak 0 → 1.0x; streak 1-2 → still 1.0x
  (no spike after a single completion); streak 3 → 1.05x; streak 9 → 1.15x; streak 30+ →
  capped at 1.5x; a gap day resets the streak/multiplier to 1.0x; floor never goes below
  1.0x regardless of poor history.
- Update/verify `questService.js` call site and any existing tests that reference the old
  `applyDifficultyScaling` signature or `calculatePerformance`.
