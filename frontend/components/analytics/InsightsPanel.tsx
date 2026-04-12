'use client';

import { Insight } from '@/lib/api';

interface InsightsPanelProps {
  insights: Insight[];
}

const STYLES: Record<Insight['type'], { border: string; bg: string; dot: string }> = {
  success: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5',  dot: 'bg-emerald-400' },
  warning: { border: 'border-amber-500/40',   bg: 'bg-amber-500/5',    dot: 'bg-amber-400'   },
  info:    { border: 'border-accent/40',       bg: 'bg-accent/5',       dot: 'bg-accent-light' },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide mb-1">Insights</p>
      <p className="text-sm text-white font-medium mb-5">What your data is telling you</p>

      {insights.length === 0 ? (
        <p className="text-muted text-sm">No insights yet. Keep completing quests.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const s = STYLES[insight.type];
            return (
              <div
                key={i}
                className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex gap-3 items-start`}
              >
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                <div>
                  <p className="text-sm font-semibold text-white">{insight.title}</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{insight.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
