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
import { HunterStats } from '@/lib/api';

interface Props {
  stats: HunterStats;
}

const STAT_ORDER: (keyof HunterStats)[] = ['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT'];

function StatTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const { subject, value } = payload[0].payload as { subject: string; value: number };
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#a78bfa', fontWeight: 600 }}>{subject}</span>
      <span style={{ color: '#fff', marginLeft: 8 }}>{value}</span>
    </div>
  );
}

export default function StatsRadarChart({ stats }: Props) {
  const data = STAT_ORDER.map((key) => ({ subject: key, value: stats[key] }));

  return (
    <div className="px-6 pt-5 pb-6 border-t border-border">
      <p className="text-xs text-muted uppercase tracking-widest text-center mb-1">
        Hunter Stats
      </p>

      {/* Glow filter applied via an inline SVG def */}
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

      <ResponsiveContainer width="100%" height={230}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
          <PolarGrid stroke="#2a2a2a" strokeDasharray="3 3" />

          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#a78bfa', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}
            tickLine={false}
          />

          {/* Hidden radius axis — fixes the domain at 0–100 */}
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />

          <Tooltip content={<StatTooltip />} />

          <Radar
            name="Stats"
            dataKey="value"
            stroke="#a78bfa"
            strokeWidth={2}
            fill="#7c3aed"
            fillOpacity={0.2}
            isAnimationActive
            animationDuration={800}
            style={{ filter: 'url(#stat-glow)' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
