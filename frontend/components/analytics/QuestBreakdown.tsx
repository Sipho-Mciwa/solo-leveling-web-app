'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts';
import { QuestStat } from '@/lib/api';

function QuestTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const q = payload[0]?.payload as QuestStat | undefined;
  if (!q) return null;
  const color = barColor(q.completionRate);
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12, padding: '8px 12px' }}>
      <p style={{ color: '#999', marginBottom: 4 }}>{label}</p>
      <p style={{ color, fontWeight: 600 }}>
        {q.completionRate}%
        <span style={{ color: '#888', fontWeight: 400 }}> · {q.completedDays}/{q.totalDays} days</span>
      </p>
    </div>
  );
}

interface QuestBreakdownProps {
  quests: QuestStat[];
}

function barColor(rate: number) {
  if (rate >= 80) return '#10b981'; // emerald
  if (rate >= 50) return '#7c3aed'; // accent
  return '#ef4444';                 // red
}

export default function QuestBreakdown({ quests }: QuestBreakdownProps) {
  if (quests.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">Quest Breakdown</p>
        <p className="text-muted text-sm mt-8 text-center pb-8">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide mb-1">Quest Breakdown</p>
      <p className="text-sm text-white font-medium mb-5">Completion % per quest (30 days)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={quests} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="title"
            tick={{ fill: '#666', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <Tooltip content={<QuestTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="completionRate" radius={[4, 4, 0, 0]}>
            {quests.map((q) => (
              <Cell key={q.questId} fill={barColor(q.completionRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center">
        {[
          { color: '#10b981', label: '≥80% great' },
          { color: '#7c3aed', label: '50–79% ok' },
          { color: '#ef4444', label: '<50% needs work' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
            <span className="text-xs text-muted">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
