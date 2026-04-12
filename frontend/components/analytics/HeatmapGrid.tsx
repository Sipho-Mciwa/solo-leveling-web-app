'use client';

import { HeatmapEntry } from '@/lib/api';

interface HeatmapGridProps {
  data: HeatmapEntry[];
}

function cellStyle(entry: HeatmapEntry): string {
  if (entry.total === 0) return 'bg-subtle/40'; // no quests generated
  const ratio = entry.completed / entry.total;
  if (ratio === 0) return 'bg-surface border border-border/60';
  if (ratio < 0.5) return 'bg-emerald-900/50';
  if (ratio < 1) return 'bg-emerald-700/60';
  return 'bg-emerald-500/80';
}

function formatLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HeatmapGrid({ data }: HeatmapGridProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Pad so the grid starts on Monday
  const firstDate = data[0]?.date;
  const dayOfWeek = firstDate
    ? new Date(firstDate + 'T00:00:00').getDay()
    : 0;
  // Sunday=0 → convert to Mon-start: Mon=0..Sun=6
  const padding = (dayOfWeek + 6) % 7;
  const paddedCells: Array<HeatmapEntry | null> = [
    ...Array(padding).fill(null),
    ...data,
  ];

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide mb-1">Activity Heatmap</p>
      <p className="text-sm text-white font-medium mb-5">Daily quest completion — last 30 days</p>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {DAY_LABELS.map((d) => (
          <p key={d} className="text-center text-[10px] text-muted">{d}</p>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {paddedCells.map((entry, i) => {
          if (!entry) return <div key={`pad-${i}`} />;
          const isToday = entry.date === todayStr;
          return (
            <div
              key={entry.date}
              title={
                entry.total === 0
                  ? formatLabel(entry.date)
                  : `${formatLabel(entry.date)}: ${entry.completed}/${entry.total} quests`
              }
              className={`aspect-square rounded-md ${cellStyle(entry)} ${isToday ? 'ring-1 ring-accent' : ''}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-[10px] text-muted">Less</span>
        {['bg-surface border border-border/60', 'bg-emerald-900/50', 'bg-emerald-700/60', 'bg-emerald-500/80'].map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-muted">More</span>
      </div>
    </div>
  );
}
