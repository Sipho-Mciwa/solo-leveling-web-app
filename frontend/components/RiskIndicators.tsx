'use client';

import { UserProfile } from '@/lib/api';
import { getRiskStatus } from '@/lib/engagementService';

interface RiskIndicatorsProps {
  streakCount: number;
  profile: UserProfile;
}

export default function RiskIndicators({ streakCount, profile }: RiskIndicatorsProps) {
  const { streakAtRisk, rankAtRisk } = getRiskStatus(profile);

  return (
    <div className="flex items-center gap-4">
      {/* Streak */}
      <div className="text-center">
        <p
          className={`text-base sm:text-lg font-bold leading-none transition-colors ${
            streakAtRisk ? 'text-amber-400' : 'text-white'
          }`}
        >
          {streakCount}
        </p>
        <p
          className={`text-[10px] sm:text-xs transition-colors ${
            streakAtRisk ? 'text-amber-500' : 'text-muted'
          }`}
        >
          {streakAtRisk ? 'protect' : 'day'} streak
        </p>
      </div>

      {/* Rank-at-risk warning */}
      {rankAtRisk && (
        <div className="text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full leading-tight text-center">
          rank<br />at risk
        </div>
      )}
    </div>
  );
}
