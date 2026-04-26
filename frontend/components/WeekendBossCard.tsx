'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WeekendBoss,
  WeekendBossStatus,
  completeWeekendBoss,
  claimWeekendBossReward,
  XPResult,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // ms
}

interface Props {
  boss: WeekendBoss;
  onUpdate: (boss: WeekendBoss) => void;
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

function computeTimeLeft(endTime: string): TimeLeft {
  const total = Math.max(0, new Date(endTime).getTime() - Date.now());
  return {
    total,
    hours:   Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeekendBossCard({ boss, onUpdate }: Props) {
  const { refreshProfile } = useAuth();

  const [status,    setStatus]    = useState<WeekendBossStatus>(boss.status);
  const [timeLeft,  setTimeLeft]  = useState<TimeLeft>(computeTimeLeft(boss.endTime));
  const [inputVal,  setInputVal]  = useState('');
  const [notes,     setNotes]     = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [submitting,setSubmitting]= useState(false);
  const [claiming,  setClaiming]  = useState(false);
  const [claimXP,   setClaimXP]   = useState<XPResult | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live countdown
  useEffect(() => {
    if (status !== 'active') return;
    intervalRef.current = setInterval(() => {
      const tl = computeTimeLeft(boss.endTime);
      setTimeLeft(tl);
      if (tl.total === 0) {
        setStatus('expired');
        clearInterval(intervalRef.current!);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [boss.endTime, status]);

  // ── Submit completion ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);
    const num = parseFloat(inputVal);
    if (isNaN(num) || num <= 0) {
      setError('Enter a valid number.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await completeWeekendBoss(boss.id, num, notes);
      if (result.success) {
        const updated = { ...boss, status: 'completed' as WeekendBossStatus };
        setStatus('completed');
        onUpdate(updated);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Claim XP ─────────────────────────────────────────────────────────────────
  async function handleClaim() {
    setClaiming(true);
    try {
      const result = await claimWeekendBossReward(boss.id);
      if (result.claimed && result.xp) {
        setClaimXP(result.xp);
        setStatus('claimed');
        onUpdate({ ...boss, status: 'claimed' });
        refreshProfile();
      } else {
        setError(result.message || 'Claim failed.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setClaiming(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const isUrgent   = timeLeft.total < 3_600_000 && status === 'active'; // < 1 hour
  const borderColor =
    status === 'claimed'  ? 'border-yellow-400/50' :
    status === 'expired'  ? 'border-gray-600/40'   :
    status === 'completed'? 'border-green-500/40'  :
    isUrgent              ? 'border-red-500/50'    :
                            'border-red-600/30';

  const bgColor =
    status === 'claimed'  ? 'bg-yellow-500/5' :
    status === 'expired'  ? 'bg-gray-900/30'  :
    status === 'completed'? 'bg-green-900/10' :
                            'bg-red-950/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-2xl border p-5 mb-4 ${borderColor} ${bgColor}`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <motion.span
            className="text-2xl"
            animate={status === 'active' ? { scale: [1, 1.12, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
          >
            {status === 'claimed' ? '🏆' : status === 'expired' ? '💀' : '⚡'}
          </motion.span>
          <div>
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
              Weekend Boss
            </p>
            <h3 className="text-sm font-bold text-white mt-0.5">{boss.title}</h3>
          </div>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} />
      </div>

      {/* ── Lore ────────────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted mt-3 leading-relaxed">{boss.description}</p>
      <p className="text-[11px] text-red-400/70 italic mt-1.5">"{boss.flavourText}"</p>

      {/* ── Countdown ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'active' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 mb-4"
          >
            <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Time remaining</p>
            <div className="flex items-center gap-3">
              {[
                { val: timeLeft.hours,   label: 'HRS' },
                { val: timeLeft.minutes, label: 'MIN' },
                { val: timeLeft.seconds, label: 'SEC' },
              ].map(({ val, label }, i) => (
                <div key={label} className="flex items-center gap-3">
                  {i > 0 && <span className={`text-lg font-bold ${isUrgent ? 'text-red-400' : 'text-muted'}`}>:</span>}
                  <div className="text-center">
                    <motion.p
                      key={val}
                      initial={{ opacity: 0.6, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className={`text-2xl font-bold tabular-nums leading-none ${
                        isUrgent ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      {pad(val)}
                    </motion.p>
                    <p className="text-[9px] text-muted mt-1 tracking-widest">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Requirement ─────────────────────────────────────────────────────── */}
      <div className="mt-3 mb-4 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5">
        <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Objective</p>
        <p className="text-sm text-white font-medium">{boss.requirements.label}</p>
        <p className="text-xs text-red-400/70 mt-1">
          Min: {boss.requirements.minValue} {boss.requirements.unit} · +{boss.xpReward} XP on claim
        </p>
      </div>

      {/* ── Input section (active only) ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {status === 'active' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Log your result</p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="0"
                step={boss.requirements.type === 'run' ? '0.1' : '1'}
                placeholder={boss.requirements.type === 'run' ? 'km covered' : 'reps completed'}
                value={inputVal}
                onChange={(e) => { setInputVal(e.target.value); setError(null); }}
                className="flex-1 bg-surface border border-border text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:border-red-500/60 placeholder:text-muted/50"
              />
              <span className="text-xs text-muted shrink-0">{boss.requirements.unit}</span>
            </div>
            <textarea
              placeholder="Optional notes (form, time, conditions...)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-surface border border-border text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-red-500/40 placeholder:text-muted/40 resize-none mb-3"
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-400 mb-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleSubmit}
              disabled={submitting || !inputVal}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl bg-red-600/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold tracking-wide transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Result'}
            </motion.button>
          </motion.div>
        )}

        {/* ── Completed — claim available ────────────────────────────────────── */}
        {status === 'completed' && (
          <motion.div
            key="claim"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 280, damping: 22 }}
            className="text-center"
          >
            <p className="text-sm text-green-400 font-semibold mb-1">Challenge Completed</p>
            {boss.submission && (
              <p className="text-xs text-muted mb-4">
                Submitted: {boss.submission.value} {boss.requirements.unit}
                {boss.submission.notes && ` · "${boss.submission.notes}"`}
              </p>
            )}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-400 mb-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <motion.button
              onClick={handleClaim}
              disabled={claiming}
              whileTap={{ scale: 0.96 }}
              animate={{ boxShadow: ['0 0 0px rgba(234,179,8,0)', '0 0 18px rgba(234,179,8,0.4)', '0 0 0px rgba(234,179,8,0)'] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-bold tracking-wide transition-colors"
            >
              {claiming ? 'Claiming...' : `Claim ${boss.xpReward} XP`}
            </motion.button>
          </motion.div>
        )}

        {/* ── Claimed ───────────────────────────────────────────────────────── */}
        {status === 'claimed' && (
          <motion.div
            key="claimed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 300, damping: 20 }}
            className="text-center py-2"
          >
            <p className="text-lg font-bold text-yellow-400">Boss Defeated</p>
            {claimXP ? (
              <p className="text-xs text-muted mt-1">
                +{claimXP.xpGained} XP · Level {claimXP.level}
                {claimXP.leveledUp && (
                  <span className="ml-2 text-accent-light font-semibold">Level Up!</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-muted mt-1">+{boss.xpReward} XP claimed</p>
            )}
          </motion.div>
        )}

        {/* ── Expired ───────────────────────────────────────────────────────── */}
        {status === 'expired' && (
          <motion.div
            key="expired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-2"
          >
            <p className="text-sm text-gray-500 font-semibold">The boss escaped the dungeon.</p>
            <p className="text-xs text-gray-600 mt-1">Challenge window has closed.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WeekendBossStatus }) {
  const config = {
    active:    { label: 'Live',     className: 'text-red-400 bg-red-400/10 border-red-400/25' },
    completed: { label: 'Done',     className: 'text-green-400 bg-green-400/10 border-green-400/25' },
    claimed:   { label: 'Defeated', className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25' },
    expired:   { label: 'Expired',  className: 'text-gray-500 bg-gray-500/10 border-gray-500/25' },
  }[status];

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}
