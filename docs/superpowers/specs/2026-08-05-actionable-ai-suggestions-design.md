# Actionable AI Suggestions ("Coach Suggests")

## Problem

The "Coach Suggests" cards in `ChallengeSection.tsx` show two AI-generated daily
protocols (title, description, XP reward) but are purely informational — there
is no way to accept one or claim its XP. This spec makes them actionable using
a two-step accept-then-complete flow, matching the existing Daily Challenges
UX pattern already used in the same section.

## Data model

`aiCache/{userId}` (Firestore, one doc per user, regenerated once per calendar
day) already stores:

```
{ date, insight, challenges: [{ title, description, xpReward }, ...] }
```

Add a `status` field to each challenge entry:

```
{ title, description, xpReward, status: 'suggested' | 'accepted' | 'completed' }
```

- Set to `'suggested'` when `generateChallenges()` first creates the day's
  entries (both the LLM path and the static-fallback path).
- The suggestion's position in the `challenges` array is its stable id for the
  day — the array is only ever written once per day (at generation) and then
  mutated in place, so index-as-id is safe. No new id field needed.

No new Firestore collection. No changes to `dailyChallenges` or `dailyQuests`.

## Backend

### `backend/services/ai.service.js`

- `generateChallenges()`: when building `DEFAULT_CHALLENGES` and parsed LLM
  challenges, attach `status: 'suggested'` to each entry before caching.
- Add `acceptChallenge(userId, index)`:
  - Load today's `aiCache` doc. 404 if missing or index out of range.
  - No-op (return current state) if already `'accepted'` or `'completed'`.
  - Otherwise set `challenges[index].status = 'accepted'`, write back, return
    the updated entry.
- Add `completeChallenge(userId, index)` (name-scoped to this module to avoid
  clashing with `challengeService.completeChallenge`; export as
  `completeAISuggestion`):
  - Firestore transaction reading both `aiCache/{userId}` and
    `users/{userId}`, mirroring `challengeService.completeChallenge`:
    - 404 if doc/index missing, 404 if user missing.
    - If already `'completed'`, return `{ alreadyCompleted: true }` (idempotent
      double-tap protection).
    - If not `'accepted'` (e.g. still `'suggested'`), throw
      `AppError('Suggestion must be accepted first', 409)`.
    - Otherwise: `computeXpGain(user, challenge.xpReward)`, write the XP/level
      update to the user doc, set `challenges[index].status = 'completed'` on
      the aiCache doc, return `{ completed: true, xp: xpResult }`.
  - After the transaction commits, fire-and-forget `evaluateTitles(userId)`
    and `updateUserRank(userId)` (same pattern as
    `challengeService.completeChallenge` — real XP can cross a rank/title
    threshold).

### `backend/routes/aiRoutes.js`

Two new routes, following the existing `PATCH /:id/complete` convention from
`challengeRoutes.js`:

```
PATCH /api/ai/challenges/:index/accept
PATCH /api/ai/challenges/:index/complete
```

- `:index` validated as a non-negative integer (0 or 1, since there are only
  ever 2 suggestions) before calling the service.
- Both routes go through `authenticate` + `aiLimiter` (already applied via
  `router.use` at the top of the file).
- Response shape: `accept` → `{ status: 'accepted' }`; `complete` → the result
  object from `completeAISuggestion` (`{ completed, xp }` or
  `{ alreadyCompleted: true }`).

## Frontend

### `frontend/lib/api.ts`

- Extend `AISuggestion` with `status: 'suggested' | 'accepted' | 'completed'`.
- Add `acceptAISuggestion(index: number)` → `PATCH /api/ai/challenges/${index}/accept`.
- Add `completeAISuggestion(index: number)` → `PATCH /api/ai/challenges/${index}/complete`.

### `frontend/components/ChallengeSection.tsx`

The suggestion card becomes a tappable button (mirroring `ChallengeItem`'s
structure) with three visual states:

1. **`suggested`** (current look, unchanged visually) — tap → call
   `acceptAISuggestion(i)`, optimistically set local status to `'accepted'`.
2. **`accepted`** — icon fills solid (vs. outlined `Sparkles`), border/bg tint
   shifts to a slightly warmer accent to read as "in progress" — tap → call
   `completeAISuggestion(i)`, on success set local status to `'completed'`
   and call `refreshProfile()` to reflect new XP/level/rank immediately.
3. **`completed`** — dimmed text, line-through title, checkmark icon, no
   longer clickable (same treatment as a completed `ChallengeItem`).

State lives in the `aiSuggestions` local state array (already present) —
update the entry's `status` in place on each successful call. No new context
needed; this doesn't need to be shared across components the way
`ChallengeContext` is.

Failed accept/complete calls: leave state unchanged and swallow the error
(consistent with the existing `.catch(() => {})` fetch-suggestions pattern) —
this is a low-stakes bonus feature, not a critical path.

## Rollover / lifecycle

No special handling needed. `aiCache` regenerates once per calendar day
(`getCachedAI` checks `data.date === todayStr()`); an `'accepted'`-but-never-
`'completed'` suggestion is simply replaced by the next day's fresh
`'suggested'` entries, same as how incomplete Daily Challenges and Daily
Quests don't carry over.

## Testing

- Backend: unit tests for `acceptChallenge` / `completeAISuggestion` in
  `backend/services/ai.service.js` (or a new `__tests__/aiChallengeActions.test.js`):
  - accept moves `suggested → accepted`; accepting twice is a no-op.
  - complete from `accepted` awards XP and sets `completed`.
  - complete from `suggested` throws 409.
  - complete when already `completed` returns `{ alreadyCompleted: true }`
    without double-awarding XP.
  - complete with an out-of-range index 404s.
- Frontend: extend/add a test for `ChallengeSection.tsx` covering the
  suggested → accepted → completed tap sequence and that `refreshProfile` is
  called on completion.

## Out of scope

- No numeric progress tracking (this isn't becoming a quest with
  `currentValue`/`targetValue`).
- No changes to the "Daily Challenges" completedCount/XP header — AI
  suggestion XP flows straight to the user's global XP/level, same path as
  Daily Challenges, but isn't folded into that section's own tally.
- No "reject/dismiss" action — only accept and complete.
