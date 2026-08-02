'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Flame, Footprints, Zap } from 'lucide-react';
import { DailyQuest } from '@/lib/api';
import ProgressBar from './ProgressBar';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import RewardPopup from './RewardPopup';
import { triggerRandomReward, RewardResult } from '@/lib/engagementService';

interface QuestCardProps {
  quest: DailyQuest;
}

// Keyed by the default quests' deterministic questId (see backend
// seedDefaultQuests), not by title — titles can be renamed/localized without
// breaking the icon lookup. Custom quests fall back to the default icon.
const QUEST_ICONS: Record<string, typeof Dumbbell> = {
  default_push_ups: Dumbbell,
  default_sit_ups: Flame,
  default_squats: Footprints,
  default_running: Footprints,
};

function DifficultyBadge({ multiplier }: { multiplier: number }) {
  const delta = multiplier - 1;
  if (Math.abs(delta) < 0.05) return null;
  const harder = delta > 0;
  const pct = Math.abs(Math.round(delta * 100));
  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
        harder ? 'text-warning bg-warning/10' : 'text-info bg-info/10'
      }`}
    >
      {harder ? '↑' : '↓'} {pct}%
    </span>
  );
}

export default function QuestCard({ quest }: QuestCardProps) {
  const { updateProgress } = useQuests();
  const { refreshProfile } = useAuth();
  const [submitting, setSubmitting]     = useState(false);
  const [reward, setReward]             = useState<RewardResult | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  const Icon            = QUEST_ICONS[quest.questId] ?? Zap;
  const effectiveTarget = quest.currentTarget ?? quest.targetValue;
  const unit            = quest.questId === 'default_running' ? 'km' : 'reps';

  // Clear the float after its animation finishes (called via onAnimationComplete)
  function clearCompleted() {
    setJustCompleted(false);
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      await updateProgress(quest.id, effectiveTarget);
      setJustCompleted(true);
      await refreshProfile();
      const result = triggerRandomReward(quest.xpReward);
      if (result.show) setReward(result);
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      layout
      className={`relative rounded-2xl border p-4 sm:p-5 transition-colors ${
        quest.completed
          ? 'border-accent/40 bg-accent/5'
          : 'border-border bg-surface'
      }`}
      // Completion bounce
      animate={justCompleted ? { y: [0, -7, 2, 0] } : { y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      // Desktop hover lift
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      // Mobile/desktop tap feedback
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
    >
      {/* Floating +XP on completion */}
      {justCompleted && (
        <motion.span
          key="xp-float"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -32 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          onAnimationComplete={clearCompleted}
          className="absolute top-3 right-4 text-sm font-bold text-accent-light pointer-events-none select-none z-10"
        >
          +{quest.xpReward} XP
        </motion.span>
      )}

      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon size={24} className="text-accent-light" />
          <div>
            <h3 className="font-semibold text-white text-sm">{quest.title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-muted">+{quest.xpReward} XP</p>
              {quest.difficultyMultiplier !== undefined && (
                <DifficultyBadge multiplier={quest.difficultyMultiplier} />
              )}
            </div>
          </div>
        </div>

        {/* Done badge springs in on completion */}
        <AnimatePresence mode="wait">
          {quest.completed ? (
            <motion.span
              key="done"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="text-xs font-medium text-accent-light bg-accent/20 px-2 py-0.5 rounded-full"
            >
              Done ✓
            </motion.span>
          ) : (
            <motion.span
              key="progress"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted"
            >
              {quest.currentValue}/{effectiveTarget} {unit}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <ProgressBar
        current={quest.currentValue}
        target={effectiveTarget}
        color={quest.completed ? 'bg-accent-light' : 'bg-accent'}
      />

      {/* Complete button — hidden when complete */}
      <AnimatePresence>
        {!quest.completed && (
          <motion.div
            key="complete-btn"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            <motion.button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className="w-full py-2.5 bg-accent hover:bg-accent/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
            >
              {submitting ? '…' : 'Complete'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonus reward popup */}
      {reward && <RewardPopup reward={reward} onDismiss={() => setReward(null)} />}
    </motion.div>
  );
}
