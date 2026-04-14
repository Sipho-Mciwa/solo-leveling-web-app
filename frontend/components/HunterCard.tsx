'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchStats, HunterStats } from '@/lib/api';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import ProfileAvatar from './ProfileAvatar';
import RankBadge from './RankBadge';
import XPProgressBar from './XPProgressBar';
import StatsRadarChart from './StatsRadarChart';

export default function HunterCard() {
  const { firebaseUser, userProfile } = useAuth();
  const [stats, setStats] = useState<HunterStats | null>(null);

  useEffect(() => {
    fetchStats()
      .then((data) => setStats(data))
      .catch(() => {}); // non-critical, fail silently
  }, []);

  if (!userProfile || !firebaseUser) return null;

  const { xp, level, rank, activeTitle } = userProfile;
  const { displayName, photoURL, email } = firebaseUser;
  const xpNeeded = xpRequiredForLevel(level);

  const name = displayName ?? email?.split('@')[0] ?? 'Hunter';

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      {/* Identity */}
      <div className="flex flex-col items-center text-center px-8 pt-10 pb-8">
        <ProfileAvatar photoURL={photoURL} displayName={displayName} email={email} />

        <h1 className="text-xl font-bold text-white mt-5 leading-tight">{name}</h1>

        <div className="flex items-center gap-2 mt-3">
          <RankBadge rank={rank ?? 'E'} size="md" />
          {activeTitle && (
            <span className="text-xs text-muted italic">"{activeTitle}"</span>
          )}
        </div>
      </div>

      {/* XP bar */}
      <div className="px-8 pb-8">
        <XPProgressBar xp={xp} level={level} xpNeeded={xpNeeded} />
      </div>

      {/* Radar chart */}
      {stats && <StatsRadarChart stats={stats} />}
    </div>
  );
}
