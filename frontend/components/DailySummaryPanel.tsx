'use client';

import { useChallenges } from '@/context/ChallengeContext';
import { useQuests } from '@/context/QuestContext';

const CHALLENGE_BASE_XP = 100; // sum of all challenge rewards
const CHALLENGE_BONUS_XP = 100; // all-complete bonus
const CHALLENGE_MAX_XP = CHALLENGE_BASE_XP + CHALLENGE_BONUS_XP;

export default function DailySummaryPanel() {
  const { challengeDoc } = useChallenges();
  const { quests } = useQuests();

  const challengeEarned = challengeDoc
    ? challengeDoc.challenges
        .filter((c) => c.completed)
        .reduce((s, c) => s + c.xpReward, 0) +
      (challengeDoc.bonusAwarded ? CHALLENGE_BONUS_XP : 0)
    : 0;

  const questEarned = quests
    .filter((q) => q.completed)
    .reduce((s, q) => s + q.xpReward, 0);

  const questMaxXp = quests.reduce((s, q) => s + q.xpReward, 0);
  const totalEarned = challengeEarned + questEarned;
  const totalMaxXp = CHALLENGE_MAX_XP + questMaxXp;

  if (!challengeDoc && quests.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Today's XP</h3>
        <span className="text-white font-bold text-sm">
          {totalEarned}
          <span className="text-muted font-normal"> / {totalMaxXp} XP</span>
        </span>
      </div>

      <div className="space-y-3">
        <XpRow
          label="Challenges"
          note="discipline"
          earned={challengeEarned}
          max={CHALLENGE_MAX_XP}
          barColor="bg-yellow-400"
          textColor="text-yellow-400"
        />
        <XpRow
          label="Quests"
          note="progression"
          earned={questEarned}
          max={questMaxXp}
          barColor="bg-accent"
          textColor="text-accent-light"
        />
      </div>
    </div>
  );
}

function XpRow({
  label,
  note,
  earned,
  max,
  barColor,
  textColor,
}: {
  label: string;
  note: string;
  earned: number;
  max: number;
  barColor: string;
  textColor: string;
}) {
  const pct = max > 0 ? Math.min((earned / max) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted">
          {label}{' '}
          <span className="text-muted/50">— {note}</span>
        </span>
        <span className={textColor}>
          {earned}/{max} XP
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
