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
} from 'recharts';
import { QuestStat } from '@/lib/api';

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
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#999' }}
            formatter={(value: number, _: string, item) => {
              const q = item.payload as QuestStat | undefined;
              const days = q ? ` (${q.completedDays}/${q.totalDays} days)` : '';
              return [`${value}%${days}`, 'Completion'] as [string, string];
            }}
          />
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
