'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DailyRate } from '@/lib/api';

interface CompletionChartProps {
  dailyRates: DailyRate[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CompletionChart({ dailyRates }: CompletionChartProps) {
  // Only plot days where quests existed; fill missing with 0 for visual continuity
  const data = dailyRates.map((d) => ({
    date: formatDate(d.date),
    rate: d.rate !== null ? Math.round(d.rate * 100) : null,
  }));

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide mb-1">30-Day Completion Rate</p>
      <p className="text-sm text-white font-medium mb-5">Daily quest completion %</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={4}
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
            formatter={(value: number) => [`${value}%`, 'Completion']}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#a78bfa' }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
