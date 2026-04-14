'use client';

import { QuestDayEntry } from '@/lib/api';

interface TableCellProps {
  entry?: QuestDayEntry;
  isToday: boolean;
  isFuture: boolean;
}

export default function TableCell({ entry, isToday, isFuture }: TableCellProps) {
  const base = `w-7 h-7 sm:w-8 sm:h-8 rounded-md mx-auto`;
  const ring = isToday ? 'ring-1 ring-accent/50' : '';

  // Future days — blank
  if (isFuture) {
    return <div className={`${base} ${ring}`} />;
  }

  // Completed
  if (entry?.completed) {
    return (
      <div
        title="Completed"
        className={`${base} flex items-center justify-center bg-emerald-500/20 ${ring}`}
      >
        <svg
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  // Partial progress (logged but not done)
  if (entry && entry.currentValue > 0) {
    return (
      <div
        title={`In progress (${entry.currentValue})`}
        className={`${base} flex items-center justify-center bg-amber-500/10 ${ring}`}
      >
        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400/70" />
      </div>
    );
  }

  // Missed / not started
  return (
    <div
      title="Not completed"
      className={`${base} flex items-center justify-center ${ring}`}
    >
      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-subtle" />
    </div>
  );
}
