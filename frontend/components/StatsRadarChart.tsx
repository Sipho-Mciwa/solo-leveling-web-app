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
import { HunterStats } from '@/lib/api';

export type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

interface Props {
  stats: HunterStats;
  weakestStat: StatKey | null;
  /** Omits the panel border/background — for nesting inside another panel. */
  bare?: boolean;
}

export const STAT_ORDER: StatKey[] = ['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT'];

export const STAT_LABELS: Record<StatKey, string> = {
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

export default function StatsRadarChart({ stats, weakestStat, bare = false }: Props) {
  const data = STAT_ORDER.map((key) => ({ subject: STAT_LABELS[key], value: stats[key] }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={bare ? '' : 'rounded-xl border border-border bg-surface p-4'}
    >
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[10px] text-muted uppercase tracking-widest">Stats</p>
        {weakestStat && (
          <p className="text-[10px] text-amber-400/80">{STAT_LABELS[weakestStat]} weakest</p>
        )}
      </div>

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
    </motion.div>
  );
}
