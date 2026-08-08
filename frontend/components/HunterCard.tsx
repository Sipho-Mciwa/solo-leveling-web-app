'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useAuth } from '@/context/AuthContext';
import { fetchStats, HunterStats } from '@/lib/api';
import StatsRadarChart, { StatKey, STAT_ORDER, STAT_LABELS } from './StatsRadarChart';
import { getHunterDetails } from '@/lib/hunterDetails';

// ─── Animation variants ───────────────────────────────────────────────────────

const sectionVariant = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' as const, delay } },
});

// ─── Small layout primitives ───────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>
      <span className="text-xs text-white font-medium">{value}</span>
    </div>
  );
}

function StatNumber({ stats, statKey, isWeak }: { stats: HunterStats; statKey: StatKey; isWeak: boolean }) {
  const d = stats.delta[statKey];
  const absD = Math.abs(d);
  const deltaLabel = absD <= 3 ? '—' : d > 0 ? `+${d}` : `${d}`;
  const deltaColor = absD <= 3 ? 'text-muted' : d > 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[9px] font-semibold uppercase tracking-wide ${isWeak ? 'text-amber-400' : 'text-muted'}`}>
        {STAT_LABELS[statKey]}
      </span>
      <span className={`text-sm font-bold tabular-nums leading-none font-display ${isWeak ? 'text-amber-400' : 'text-white'}`}>
        <CountUp end={stats[statKey]} duration={1.1} useEasing />
      </span>
      <span className={`text-[9px] tabular-nums leading-none ${deltaColor}`}>{deltaLabel}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeakestStat(stats: HunterStats): StatKey {
  return STAT_ORDER.reduce((a, b) => (stats[a] < stats[b] ? a : b));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HunterCard() {
  const { firebaseUser, userProfile } = useAuth();

  const [stats,     setStats]     = useState<HunterStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchStats().then(setStats).catch(() => {
      setLoadError('Stats failed to load. Try refreshing.');
    });
  }, [firebaseUser]);

  if (!userProfile || !firebaseUser) return null;

  const { uid, displayName } = firebaseUser;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const weakestStat: StatKey | null = stats ? getWeakestStat(stats) : null;

  // ── Character sheet ──────────────────────────────────────────────────────
  const details = getHunterDetails(uid, displayName, userProfile, stats);

  return (
    <motion.div
      {...sectionVariant(0)}
      className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4"
    >

      {/* ── Hunter details + stats — always side by side, even on mobile ────── */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] text-muted uppercase tracking-widest">Hunter Details</p>
            {details.isPlaceholder && (
              <span className="text-[9px] text-muted/60 italic shrink-0">unverified</span>
            )}
          </div>
          <div className="space-y-2">
            <DetailRow label="Name"       value={details.firstName} />
            <DetailRow label="Surname"    value={details.lastName || '—'} />
            <DetailRow label="Height"     value={details.height} />
            <DetailRow label="Age"        value={details.age} />
            <DetailRow label="Weight"     value={details.weight} />
            <DetailRow label="Sex"        value={details.sex} />
            <DetailRow label="Job Class"  value={details.jobClass} />
            <DetailRow label="Hunter ID"  value={details.hunterId} />
          </div>
        </div>

        <AnimatePresence>
          {stats && (
            <motion.div
              key="stats-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <StatsRadarChart stats={stats} weakestStat={weakestStat} bare />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom row: stat numbers ──────────────────────────────────────────── */}
      <div className="border-t border-border pt-4 flex items-center">
        {stats ? (
          <div className="flex-1 grid grid-cols-5">
            {STAT_ORDER.map((key) => (
              <StatNumber key={key} stats={stats} statKey={key} isWeak={key === weakestStat} />
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {loadError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-warning"
              >
                {loadError}
              </motion.p>
            )}
          </AnimatePresence>
        )}
      </div>

    </motion.div>
  );
}
