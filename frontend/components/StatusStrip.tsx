'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuests } from '@/context/QuestContext';
import { fetchRankProgress, RankProgress } from '@/lib/api';
import RankProgressBar from './RankProgressBar';
import StreakPanel from './StreakPanel';
import NextObjectiveCard from './NextObjectiveCard';

export default function StatusStrip() {
  const { userProfile } = useAuth();
  const { quests, loading } = useQuests();
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    fetchRankProgress().then(setRankProgress).catch(() => {});
  }, [userProfile]);

  if (!userProfile) return null;

  const { rank, streakCount } = userProfile;
  const questsReady   = !loading;
  const questsDone    = quests.filter((q) => q.completed).length;
  const questsTotal   = quests.length;
  const streakAtRisk  = streakCount > 0 && questsTotal > 0 && questsDone === 0;
  const nextQuest     = quests.find((q) => !q.completed) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-4 mb-6">
      <RankProgressBar rank={rank} rankProgress={rankProgress} variant="compact" />
      <StreakPanel
        streakCount={streakCount}
        streakAtRisk={streakAtRisk}
        activePenalty={false}
        showPressure={false}
        hoursLeft={0}
        minutesLeft={0}
        questsRemaining={0}
        variant="compact"
      />
      {questsReady && nextQuest && <NextObjectiveCard quest={nextQuest} ready={questsReady} />}
    </div>
  );
}
