'use client';

import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';

interface StreakPanelProps {
  streakCount: number;
  streakAtRisk: boolean;
  activePenalty: boolean;
  showPressure: boolean;
  hoursLeft: number;
  minutesLeft: number;
  questsRemaining: number;
  variant: 'full' | 'compact';
}

export default function StreakPanel({
  streakCount,
  streakAtRisk,
  activePenalty,
  showPressure,
  hoursLeft,
  minutesLeft,
  questsRemaining,
  variant,
}: StreakPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-sm font-bold text-white tabular-nums"
            animate={
              streakAtRisk
                ? { opacity: [1, 0.45, 1] }
                : streakCount >= 7
                ? { scale: [1, 1.08, 1] }
                : {}
            }
            transition={
              streakAtRisk || streakCount >= 7
                ? { repeat: Infinity, duration: streakAtRisk ? 1.1 : 2.2 }
                : {}
            }
          >
            <CountUp end={streakCount} duration={1.1} />
          </motion.span>
          <span className="text-xs text-muted">day streak</span>
        </div>

        <AnimatePresence mode="wait">
          {streakAtRisk ? (
            <motion.span
              key="risk"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className="text-xs font-semibold text-warning bg-warning/10 border border-warning/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
            >
              At risk
            </motion.span>
          ) : streakCount >= 7 ? (
            <motion.span
              key="fire"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              className="text-xs font-semibold text-accent-light bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
            >
              On fire
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {variant === 'full' && (
        <>
          <AnimatePresence>
            {activePenalty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-danger bg-danger/8 border border-danger/20 rounded-lg px-3 py-2"
              >
                <span className="text-xs font-semibold shrink-0">!</span>
                <p className="text-[11px] font-medium">
                  Penalty active — complete it to restore rank progress
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPressure && !activePenalty && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-warning bg-warning/8 border border-warning/20 rounded-lg px-3 py-2"
              >
                <span className="text-xs shrink-0">⏱</span>
                <p className="text-[11px] font-medium">
                  {hoursLeft}h {minutesLeft}m left today — {questsRemaining} quest
                  {questsRemaining !== 1 ? 's' : ''} remaining
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
