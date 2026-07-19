'use client';

import { Flame, AlertTriangle } from 'lucide-react';
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
      <div className="flex items-center gap-1 text-center">
        {streakCount >= 7 && !streakAtRisk && <Flame size={14} className="text-accent-light" />}
        <div>
          <p
            className={`text-base sm:text-lg font-bold leading-none transition-colors font-display ${
              streakAtRisk ? 'text-warning' : 'text-white'
            }`}
          >
            {streakCount}
          </p>
          <p
            className={`text-[10px] sm:text-xs transition-colors ${
              streakAtRisk ? 'text-warning' : 'text-muted'
            }`}
          >
            {streakAtRisk ? 'protect' : 'day'} streak
          </p>
        </div>
      </div>

      {rankAtRisk && (
        <div className="flex items-center gap-1 text-[10px] text-warning bg-warning/10 border border-warning/20 px-2 py-1 rounded-full leading-tight text-center">
          <AlertTriangle size={12} />
          <span>rank<br />at risk</span>
        </div>
      )}
    </div>
  );
}
