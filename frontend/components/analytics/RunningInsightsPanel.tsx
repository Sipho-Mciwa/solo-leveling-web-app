'use client';

import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { RunningAnalytics } from '@/lib/api';

interface RunningInsightsPanelProps {
  analytics: RunningAnalytics;
}

const listVariants = {
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

export default function RunningInsightsPanel({ analytics }: RunningInsightsPanelProps) {
  const { totalRuns, totalDistanceKm, avgPaceLabel, consistencyScore, insights } = analytics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-surface border border-border rounded-2xl p-5 space-y-5"
    >
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Runs" value={totalRuns} />
        <Stat label="Total Distance" value={totalDistanceKm} suffix=" km" decimals={2} />
        <Stat label="Avg Pace" value={avgPaceLabel || '—'} isPace />
      </div>

      {/* Consistency bar */}
      <div>
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-muted uppercase tracking-wide">Weekly Consistency</span>
          <span className="text-white font-semibold">
            <CountUp end={consistencyScore} duration={1.5} suffix="%" />
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${consistencyScore}%` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            className="h-full rounded-full bg-[#FC4C02]"
          />
        </div>
        <p className="text-[10px] text-muted mt-1">Weeks with at least 1 run in the last 4</p>
      </div>

      {/* Insights */}
      <div>
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Insights</p>
        <motion.ul
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {insights.map((insight, i) => (
            <motion.li
              key={i}
              variants={itemVariants}
              className="flex gap-2 text-xs text-accent-light/90 leading-relaxed"
            >
              <span className="text-[#FC4C02] mt-0.5 shrink-0">›</span>
              {insight}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  suffix = '',
  decimals = 0,
  isPace = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  decimals?: number;
  isPace?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-white tabular-nums">
        {typeof value === 'number' ? (
          <CountUp end={value} duration={1.2} decimals={decimals} suffix={suffix} />
        ) : isPace && value !== '—' ? (
          (() => {
            // value format "MM:SS"
            const [m, s] = String(value).split(':').map(Number);
            return (
              <>
                <CountUp end={m} duration={1} />
                :
                <CountUp end={s} duration={1} start={0} formattingFn={(n) => String(n).padStart(2, '0')} />
                {suffix || ' /km'}
              </>
            );
          })()
        ) : (
          value
        )}
      </p>
      <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
