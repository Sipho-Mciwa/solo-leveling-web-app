'use client';

import { useQuests } from '@/context/QuestContext';
import { useChallenges } from '@/context/ChallengeContext';

export default function DailySnapshot() {
  const { quests } = useQuests();
  const { challengeDoc } = useChallenges();

  const questsDone      = quests.filter((q) => q.completed).length;
  const questsTotal     = quests.length;
  const challengesDone  = challengeDoc?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = challengeDoc?.challenges.length ?? 0;

  return (
    <div className="grid grid-cols-2 rounded-2xl border border-border bg-surface divide-x divide-border overflow-hidden mb-6">
      <div className="px-4 py-3 text-center">
        <p className="text-base font-bold text-white tabular-nums leading-none">
          {questsTotal > 0 ? `${questsDone}/${questsTotal}` : '—'}
        </p>
        <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Quests</p>
      </div>
      <div className="px-4 py-3 text-center">
        <p className="text-base font-bold text-white tabular-nums leading-none">
          {challengesTotal > 0 ? `${challengesDone}/${challengesTotal}` : '—'}
        </p>
        <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Challenges</p>
      </div>
    </div>
  );
}
