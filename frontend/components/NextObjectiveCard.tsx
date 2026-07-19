'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DailyQuest } from '@/lib/api';

interface NextObjectiveCardProps {
  quest: DailyQuest | null;
  ready: boolean;
}

export default function NextObjectiveCard({ quest, ready }: NextObjectiveCardProps) {
  if (!ready || !quest) return null;

  const target    = quest.currentTarget ?? quest.targetValue;
  const remaining = Math.max(0, target - quest.currentValue);

  return (
    <AnimatePresence>
      <motion.div
        key="next-obj"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
              Next objective
            </p>
            <p className="text-sm font-semibold text-white truncate">{quest.title}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted mb-1">&nbsp;</p>
            <p className="text-xs text-accent-light tabular-nums">
              {quest.currentValue} / {target}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-subtle overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-accent/60"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (quest.currentValue / target) * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="text-[10px] text-muted mt-1">
          {remaining} {quest.title.toLowerCase().includes('run') ? 'km' : 'reps'} remaining
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
