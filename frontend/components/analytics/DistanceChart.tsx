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
import { RunningWeeklyData } from '@/lib/api';

interface DistanceChartProps {
  data: RunningWeeklyData[];
}

export default function DistanceChart({ data }: DistanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-center h-52">
        <p className="text-muted text-sm">No weekly data yet.</p>
      </div>
    );
  }

  const maxDist = Math.max(...data.map((d) => d.totalDistance));
  const thisWeek = data[data.length - 1];

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Weekly Distance</p>
          <p className="text-sm text-white font-medium mt-0.5">km per week</p>
        </div>
        {thisWeek && (
          <span className="text-xs text-[#FC4C02] font-semibold bg-[#FC4C02]/10 border border-[#FC4C02]/20 rounded-full px-2.5 py-1">
            {thisWeek.totalDistance} km this week
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit=" km"
          />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#999' }}
            formatter={(value: number, _: string, props: { payload: RunningWeeklyData }) => [
              `${value} km  ·  ${props.payload.runs} run${props.payload.runs !== 1 ? 's' : ''}${props.payload.avgPaceLabel ? `  ·  avg ${props.payload.avgPaceLabel} /km` : ''}`,
              'Distance',
            ]}
          />
          <Bar dataKey="totalDistance" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.totalDistance === maxDist ? '#FC4C02' : '#FC4C02'}
                fillOpacity={entry.totalDistance === maxDist ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted mt-2">Brightest bar = best week · hover for pace</p>
    </div>
  );
}
