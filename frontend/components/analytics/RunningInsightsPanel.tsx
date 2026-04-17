'use client';

import { RunningAnalytics } from '@/lib/api';

interface RunningInsightsPanelProps {
  analytics: RunningAnalytics;
}

export default function RunningInsightsPanel({ analytics }: RunningInsightsPanelProps) {
  const { totalRuns, totalDistanceKm, avgPaceLabel, consistencyScore, insights } = analytics;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Runs" value={String(totalRuns)} />
        <Stat label="Total Distance" value={`${totalDistanceKm} km`} />
        <Stat label="Avg Pace" value={avgPaceLabel ? `${avgPaceLabel} /km` : '—'} />
      </div>

      {/* Consistency bar */}
      <div>
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted uppercase tracking-wide">Weekly Consistency</span>
          <span className="text-white font-semibold">{consistencyScore}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FC4C02] transition-all duration-700"
            style={{ width: `${consistencyScore}%` }}
          />
        </div>
        <p className="text-[10px] text-muted mt-1">Weeks with at least 1 run in the last 4</p>
      </div>

      {/* Insights */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Insights</p>
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-2 text-xs text-accent-light/90 leading-relaxed">
              <span className="text-[#FC4C02] mt-0.5 shrink-0">›</span>
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
