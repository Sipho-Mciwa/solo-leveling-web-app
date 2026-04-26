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
import { motion } from 'framer-motion';
import { QuestHistoryRow } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPoint {
  day: number;
  rate: number;       // 0–100 completion %, or 0 when no quests generated
  completed: number;
  total: number;
  isToday: boolean;
  hasData: boolean;
}

// ─── Data derivation ──────────────────────────────────────────────────────────

function buildData(rows: QuestHistoryRow[], month: string): DayPoint[] {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateKey = `${month}-${String(day).padStart(2, '0')}`;
    let completed = 0;
    let total = 0;

    for (const row of rows) {
      const entry = row.history[dateKey];
      if (entry !== undefined) {
        total++;
        if (entry.completed) completed++;
      }
    }

    return {
      day,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
      isToday: dateKey === todayStr,
      hasData: total > 0,
    };
  });
}

// ─── Bar color ────────────────────────────────────────────────────────────────

function barFill(d: DayPoint): string {
  if (!d.hasData) return '#1c1c1c';
  if (d.isToday) return '#a78bfa';
  if (d.rate === 100) return '#4ade80';
  if (d.rate >= 60)   return '#7c3aed';
  if (d.rate > 0)     return '#f59e0b';
  return '#3f1212';  // deep red tint for 0/total days
}

function barOpacity(d: DayPoint): number {
  return d.hasData ? 1 : 0.4;
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function deriveSummary(data: DayPoint[]) {
  const activeDays  = data.filter((d) => d.hasData).length;
  const perfectDays = data.filter((d) => d.hasData && d.rate === 100).length;
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const totalPossible  = data.reduce((s, d) => s + d.total, 0);
  const avgRate = totalPossible > 0
    ? Math.round((totalCompleted / totalPossible) * 100)
    : 0;
  return { activeDays, perfectDays, avgRate, totalCompleted, totalPossible };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: DayPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;

  return (
    <div style={{
      background: '#111',
      border: '1px solid #222',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      minWidth: 110,
    }}>
      <p style={{ color: '#666', marginBottom: 4 }}>Day {d.day}</p>
      <p style={{ color: '#fff', fontWeight: 600, marginBottom: 2 }}>
        {d.completed}/{d.total} completed
      </p>
      <p style={{ color: d.rate === 100 ? '#4ade80' : d.rate >= 60 ? '#a78bfa' : '#f59e0b' }}>
        {d.rate}%
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HistoryChartProps {
  rows: QuestHistoryRow[];
  month: string;       // "YYYY-MM"
  label: string;
}

export default function HistoryChart({ rows, month, label }: HistoryChartProps) {
  if (rows.length === 0) return null;

  const data = buildData(rows, month);
  const hasAnyData = data.some((d) => d.hasData);
  if (!hasAnyData) return null;

  const { activeDays, perfectDays, avgRate, totalCompleted, totalPossible } = deriveSummary(data);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-surface border border-border rounded-2xl p-5 mb-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-sm text-white font-semibold">Daily completion</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block shrink-0" />
            All
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-full bg-accent inline-block shrink-0" />
            Partial
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0" />
            Low
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={130}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 2, bottom: 0, left: -28 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="2 4" stroke="#1e1e1e" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#555', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: '#555', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.025)' }}
          />
          <Bar dataKey="rate" radius={[3, 3, 2, 2]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={barFill(d)}
                fillOpacity={barOpacity(d)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary strip */}
      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-base font-bold text-white tabular-nums leading-none">{activeDays}</p>
          <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">Active days</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-green-400 tabular-nums leading-none">{perfectDays}</p>
          <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">Perfect days</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-accent-light tabular-nums leading-none">{avgRate}%</p>
          <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">Avg completion</p>
        </div>
        <div className="text-center ml-auto">
          <p className="text-base font-bold text-white tabular-nums leading-none">
            {totalCompleted}<span className="text-muted font-normal">/{totalPossible}</span>
          </p>
          <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">Total</p>
        </div>
      </div>
    </motion.div>
  );
}
