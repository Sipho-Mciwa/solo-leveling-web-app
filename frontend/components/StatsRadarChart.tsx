'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { HunterStats } from '@/lib/api';

type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

interface Props {
  stats: HunterStats;
  weakestStat: StatKey | null;
}

const STAT_ORDER: StatKey[] = ['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT'];

const STAT_LABELS: Record<StatKey, string> = {
  PHY: 'PHY',
  SPD: 'SPD',
  STAMINA: 'STA',
  DISCIPLINE: 'DIS',
  INTELLECT: 'INT',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function StatTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const { subject, value } = payload[0].payload as { subject: string; value: number };
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#a78bfa', fontWeight: 600 }}>{subject}</span>
      <span style={{ color: '#fff', marginLeft: 8 }}>{value}</span>
    </div>
  );
}

// ─── Custom axis tick — amber for weakest stat ────────────────────────────────

type TextAnchor = React.SVGAttributes<SVGTextElement>['textAnchor'];

function AxisTick(
  props: { x?: number; y?: number; payload?: { value: string }; textAnchor?: TextAnchor },
  weakestStat: StatKey | null,
) {
  const { x = 0, y = 0, payload, textAnchor = 'middle' } = props;
  // Recharts requires a ReactElement return — use empty text if no payload
  if (!payload) return <text />;
  const isWeak = weakestStat != null && payload.value === STAT_LABELS[weakestStat];
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={isWeak ? '#f59e0b' : '#a78bfa'}
      fontSize={10}
      fontWeight={600}
      letterSpacing={0.5}
    >
      {payload.value}
    </text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatsRadarChart({ stats, weakestStat }: Props) {
  const data = STAT_ORDER.map((key) => ({ subject: STAT_LABELS[key], value: stats[key] }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="px-4 sm:px-6 pt-5 pb-4 border-t border-border"
    >
      <p className="text-[10px] text-muted uppercase tracking-widest text-center mb-1">
        Hunter Stats
      </p>

      {/* SVG glow filter */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="stat-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <ResponsiveContainer width="100%" height={190}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
          <PolarGrid stroke="#2a2a2a" strokeDasharray="3 3" />

          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => AxisTick(props, weakestStat)}
            tickLine={false}
          />

          {/* Locks domain to 0–100 */}
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />

          <Tooltip content={<StatTooltip />} />

          <Radar
            name="Stats"
            dataKey="value"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="#7c3aed"
            fillOpacity={0.2}
            isAnimationActive
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
            style={{ filter: 'url(#stat-glow)' }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Stat grid: count-up values + delta */}
      <div className="grid grid-cols-5 gap-0 mt-1 pb-1">
        {STAT_ORDER.map((key) => {
          const value  = stats[key];
          const d      = stats.delta[key];
          const isWeak = key === weakestStat;

          const absD       = Math.abs(d);
          const deltaLabel = absD <= 3 ? '—' : d > 0 ? `+${d}` : `${d}`;
          const deltaColor =
            absD <= 3 ? 'text-muted' : d > 0 ? 'text-green-400' : 'text-red-400';

          return (
            <div key={key} className="flex flex-col items-center gap-0.5">
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide ${
                  isWeak ? 'text-amber-400' : 'text-muted'
                }`}
              >
                {STAT_LABELS[key]}
              </span>
              <span
                className={`text-sm font-bold tabular-nums leading-none ${
                  isWeak ? 'text-amber-400' : 'text-white'
                }`}
              >
                <CountUp end={value} duration={1.1} useEasing />
              </span>
              <span className={`text-[9px] tabular-nums leading-none ${deltaColor}`}>
                {deltaLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Weakest stat callout */}
      {weakestStat && (
        <p className="text-[10px] text-amber-400/70 text-center mt-2">
          {STAT_LABELS[weakestStat]} is your weakest attribute
        </p>
      )}
    </motion.div>
  );
}
