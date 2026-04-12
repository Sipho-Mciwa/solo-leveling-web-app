'use client';

import { QuestDayEntry } from '@/lib/api';

interface TableCellProps {
  entry?: QuestDayEntry;
  isToday: boolean;
  isFuture: boolean;
}

export default function TableCell({ entry, isToday, isFuture }: TableCellProps) {
  // Future days — blank
  if (isFuture) {
    return (
      <div className={`w-8 h-8 rounded-md mx-auto ${isToday ? 'ring-1 ring-accent/50' : ''}`} />
    );
  }

  // Completed
  if (entry?.completed) {
    return (
      <div
        title="Completed"
        className={`w-8 h-8 rounded-md mx-auto flex items-center justify-center bg-emerald-500/20 ${isToday ? 'ring-1 ring-accent/50' : ''}`}
      >
        <svg
          className="w-4 h-4 text-emerald-400"
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
        className={`w-8 h-8 rounded-md mx-auto flex items-center justify-center bg-amber-500/10 ${isToday ? 'ring-1 ring-accent/50' : ''}`}
      >
        <div className="w-2 h-2 rounded-full bg-amber-400/70" />
      </div>
    );
  }

  // Missed / not started
  return (
    <div
      title="Not completed"
      className={`w-8 h-8 rounded-md mx-auto flex items-center justify-center ${isToday ? 'ring-1 ring-accent/50' : ''}`}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-subtle" />
    </div>
  );
}
