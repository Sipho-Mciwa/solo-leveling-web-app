'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuests } from '@/context/QuestContext';
import { fetchRankProgress, RankProgress } from '@/lib/api';
import { getUrgencyStatus } from '@/lib/engagementService';
import RankProgressBar from './RankProgressBar';
import StreakPanel from './StreakPanel';
import NextObjectiveCard from './NextObjectiveCard';

const AT_RISK_HOURS_LEFT = 5;

export default function StatusStrip() {
  const { userProfile } = useAuth();
  const { quests, loading } = useQuests();
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!userProfile) return;
    fetchRankProgress().then(setRankProgress).catch(() => {});
  }, [userProfile]);

  // Tick every 60 seconds so the at-risk badge reflects the current time of day
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!userProfile) return null;

  const { rank, streakCount } = userProfile;
  const questsReady   = !loading;
  const questsDone    = quests.filter((q) => q.completed).length;
  const questsTotal   = quests.length;
  const { hoursLeft } = getUrgencyStatus(quests, now);
  const streakAtRisk  =
    streakCount > 0 && questsTotal > 0 && questsDone === 0 && hoursLeft <= AT_RISK_HOURS_LEFT;
  const nextQuest     = quests.find((q) => !q.completed) ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-4 mb-6">
      <RankProgressBar rank={rank} rankProgress={rankProgress} variant="full" />
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
