// ─── System Voice — Frontend Utility ─────────────────────────────────────────
// Generates static, locally-computed fallback insights that conform to the
// System Voice spec when the AI backend is unavailable.
//
// Voice contract:
//   Tone:      detached, precise, non-emotional
//   Structure: Evaluation → Observation → Directive
//   Banned:    emojis, casual language, motivational phrases, contractions
// ─────────────────────────────────────────────────────────────────────────────

export type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

export interface HunterStatsInput {
  PHY: number;
  SPD: number;
  STAMINA: number;
  DISCIPLINE: number;
  INTELLECT: number;
}

// ─── Stat thresholds ──────────────────────────────────────────────────────────

const CRITICAL_THRESHOLD  = 20;
const WEAK_THRESHOLD      = 40;
const ELITE_DISCIPLINE    = 85;
const BALANCED_THRESHOLD  = 75;
const STREAK_SIGNIFICANT  = 14;

// ─── Core insight generator ───────────────────────────────────────────────────
// Evaluates the most significant data point and returns one assessment line.

export function generateLocalInsight(
  stats: HunterStatsInput | null,
  streakCount: number,
  questsDone: number,
  questsTotal: number,
): string {
  // No data — initialization state
  if (!stats) {
    return 'Hunter profile initializing. Log daily quests to establish a performance baseline.';
  }

  const entries   = (Object.entries(stats) as [StatKey, number][]);
  const weakest   = entries.reduce((a, b) => (a[1] < b[1] ? a : b));
  const strongest = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
  const avg       = entries.reduce((s, [, v]) => s + v, 0) / 5;

  // Critical attribute — highest priority signal
  if (weakest[1] < CRITICAL_THRESHOLD) {
    return `${weakest[0]} attribute: critical. Value ${weakest[1]} — below minimum viable threshold. Immediate protocol adjustment required.`;
  }

  // All quests complete — board cleared
  if (questsDone === questsTotal && questsTotal > 0) {
    return `Daily board: complete. All ${questsTotal} assigned quests executed. Output status: optimal.`;
  }

  // Elite discipline — confirm and direct
  if (stats.DISCIPLINE >= ELITE_DISCIPLINE) {
    return `Discipline attribute: ${stats.DISCIPLINE} — elite classification. Output consistency is within optimal parameters. Maintain current protocol.`;
  }

  // Well-balanced profile
  if (avg >= BALANCED_THRESHOLD) {
    return `Attribute profile: balanced. Average value ${Math.round(avg)} across all parameters. Performance status: stable. Maintain current output.`;
  }

  // Significant streak — acknowledge pattern
  if (streakCount >= STREAK_SIGNIFICANT) {
    return `Active streak: ${streakCount} consecutive days. Consistency pattern confirmed. Deviation at this stage registers as a critical setback.`;
  }

  // Weak attribute — targeted intervention
  if (weakest[1] < WEAK_THRESHOLD) {
    return `${weakest[0]} attribute: ${weakest[1]} — below acceptable threshold. Targeted protocol required. Prioritize this parameter this week.`;
  }

  // Low discipline — structural failure point
  if (stats.DISCIPLINE < WEAK_THRESHOLD) {
    return `Discipline attribute: ${stats.DISCIPLINE} — insufficient. Daily protocol completion must take priority. All other progress is secondary.`;
  }

  // Imbalanced — note the gap
  const gap = strongest[1] - weakest[1];
  if (gap > 30) {
    return `Attribute imbalance detected. ${strongest[0]}: ${strongest[0] === weakest[0] ? '—' : strongest[1]} vs ${weakest[0]}: ${weakest[1]}. Adjust training focus to reduce deviation.`;
  }

  // Default — incomplete quests
  if (questsDone < questsTotal && questsTotal > 0) {
    const remaining = questsTotal - questsDone;
    return `Quest completion: ${questsDone}/${questsTotal}. ${remaining} quest${remaining !== 1 ? 's' : ''} remaining. Execute before end of day.`;
  }

  // Stable state with no specific flags
  return `Performance output recorded. All parameters within acceptable range. Continue executing assigned protocols.`;
}
