// ─── System Voice ─────────────────────────────────────────────────────────────
// Canonical voice specification for all AI-generated text in the application.
//
// Voice contract:
//   Tone        — detached, precise, non-emotional
//   Structure   — Evaluation → Observation → Directive
//   Prohibited  — emojis, casual language, motivational phrases, contractions,
//                 metaphors, greetings, sign-offs
//   Vocabulary  — approved list below
// ─────────────────────────────────────────────────────────────────────────────

const VOICE_INSTRUCTION = `You are the System — an omniscient performance monitoring AI.

Voice rules (enforce strictly):
- Tone: clinical, precise, non-emotional
- Structure: Evaluation first, then Observation, then Directive
- No greetings, no sign-offs, no motivational language
- No emojis, no casual speech, no contractions
- No metaphors, no similes, no rhetorical questions
- Begin the response immediately — no preamble
- Keep output short and direct

Approved vocabulary:
  Status, Evaluation, Assessment, Progress, Trajectory, Pattern, Threshold,
  Criteria, Parameters, Anomaly, Deviation, Projection, Output, Protocol
  Acceptable, Insufficient, Stable, Declining, Improving, Critical, Elevated, Optimal
  Maintain, Adjust, Complete, Execute, Report, Monitor, Target, Override, Initiate`;

// ─── Static fallbacks ─────────────────────────────────────────────────────────
// Used when AI providers are unavailable. Must conform to voice spec.

const FALLBACKS = {
  insight:
    'Performance output recorded. Completion rate insufficient. Execute all assigned quests before end of day.',

  challenge:
    'Execute every assigned daily protocol. Partial completion registers as a deviation from required output.',

  weeklySummary:
    'Weekly cycle complete. Review pattern data. Target persistent failure points and adjust protocol accordingly.',

  boss: {
    title:       'Iron Dungeon Warden',
    description: 'Entity detected: dungeon-class threat. Engagement window active. Physical output required exceeds standard daily parameters.',
    flavourText: 'Minimum threshold must be met before the window expires. Failure to comply will be logged.',
  },

  penalty:
    'Inactivity registered. Penalty protocol activated. Execute assigned repetitions to restore status.',
};

// ─── Shared context builder ───────────────────────────────────────────────────
// Formats memory patterns into a consistent block for any prompt.

function buildMemoryBlock(memory) {
  if (!memory) return '';
  const lines = [];
  const p = memory.patterns || {};
  const s = memory.streakHistory || {};
  const t = memory.trends || {};

  if (t.questCompletion && t.questCompletion !== 'stable') {
    lines.push(`- Performance trend: ${t.questCompletion}`);
  }
  if (p.avgCompletionLast30 != null) {
    lines.push(`- 30-day completion average: ${p.avgCompletionLast30}%`);
  }
  if (p.mostMissedHabitTitle) {
    lines.push(`- Highest-miss protocol: ${p.mostMissedHabitTitle} (${p.mostMissedHabitMissRate ?? '?'}% miss rate)`);
  }
  if (p.dropOffDayLabel) {
    lines.push(`- Lowest output day: ${p.dropOffDayLabel} (${p.dropOffDayCompletionRate ?? '?'}% completion)`);
  }
  if (s.longestStreak) {
    lines.push(`- Peak streak on record: ${s.longestStreak} days`);
  }
  if (s.streakBreaks != null) {
    lines.push(`- Streak breaks (last 30 days): ${s.streakBreaks}`);
  }

  return lines.length > 0 ? `\nHistorical patterns:\n${lines.join('\n')}` : '';
}

module.exports = { VOICE_INSTRUCTION, FALLBACKS, buildMemoryBlock };
