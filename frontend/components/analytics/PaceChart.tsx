'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { RunningPaceEntry } from '@/lib/api';

interface PaceChartProps {
  data: RunningPaceEntry[];
  avgPaceLabel: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Lower pace = faster → invert Y axis so "better" is up
export default function PaceChart({ data, avgPaceLabel }: PaceChartProps) {
  const plotData = data
    .filter((d) => d.pace !== null)
    .map((d) => ({ date: formatDate(d.date), pace: d.pace!, km: d.distanceKm }));

  if (plotData.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-center h-52">
        <p className="text-muted text-sm">No pace data yet. Sync your first run.</p>
      </div>
    );
  }

  const avgPace =
    plotData.reduce((s, d) => s + d.pace, 0) / plotData.length;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Pace Trend</p>
          <p className="text-sm text-white font-medium mt-0.5">min / km over last 30 days</p>
        </div>
        {avgPaceLabel && (
          <span className="text-xs text-accent-light font-semibold bg-accent/10 border border-accent/20 rounded-full px-2.5 py-1">
            avg {avgPaceLabel}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={plotData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          {/* Inverted: lower value (faster) appears higher */}
          <YAxis
            reversed
            domain={['auto', 'auto']}
            tick={{ fill: '#666', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => {
              const m = Math.floor(v);
              const s = Math.round((v - m) * 60);
              return `${m}:${String(s).padStart(2, '0')}`;
            }}
          />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#999' }}
            formatter={(value: number, _name: string, props: { payload: { km: number } }) => {
              const m = Math.floor(value);
              const s = Math.round((value - m) * 60);
              return [`${m}:${String(s).padStart(2, '0')} /km  ·  ${props.payload.km} km`, 'Pace'];
            }}
          />
          <ReferenceLine
            y={avgPace}
            stroke="#7c3aed"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="pace"
            stroke="#FC4C02"
            strokeWidth={2}
            dot={{ r: 3, fill: '#FC4C02', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#FC4C02' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted mt-2">Lower is faster · dashed line = average</p>
    </div>
  );
}
