'use client';

import { useEffect, useState } from 'react';
import { DailyQuest } from '@/lib/api';
import {
  UrgencyLevel,
  getUrgencyStatus,
  generateDynamicMessage,
  formatTimeLeft,
} from '@/lib/engagementService';

interface UrgencyBannerProps {
  quests: DailyQuest[];
}

export default function UrgencyBanner({ quests }: UrgencyBannerProps) {
  const [now, setNow] = useState(() => new Date());

  // Tick every 60 seconds
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const status  = getUrgencyStatus(quests, now);
  const message = generateDynamicMessage(quests);

  if (status.level === 'none') return null;

  const timeLeft = formatTimeLeft(status.hoursLeft, status.minutesLeft);

  const styles: Record<UrgencyLevel, string> = {
    none:   '',
    low:    'border-border bg-surface text-muted',
    medium: 'border-amber-600/40 bg-amber-900/10 text-amber-400',
    high:   'border-red-600/40 bg-red-900/10 text-red-400',
  };

  const dotStyles: Record<UrgencyLevel, string> = {
    none:   '',
    low:    'bg-muted',
    medium: 'bg-amber-400 animate-pulse',
    high:   'bg-red-400 animate-pulse',
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 mb-6 flex items-center justify-between gap-4 ${styles[status.level]}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotStyles[status.level]}`} />
        <p className="text-sm truncate">{message}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
        <span>
          {status.completedCount}/{status.totalCount} done
        </span>
        <span className="opacity-60">·</span>
        <span className="font-medium">{timeLeft}</span>
      </div>
    </div>
  );
}
