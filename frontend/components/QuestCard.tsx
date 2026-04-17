'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DailyQuest } from '@/lib/api';
import ProgressBar from './ProgressBar';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import RewardPopup from './RewardPopup';
import StravaSyncButton from './StravaSyncButton';
import { triggerRandomReward, RewardResult } from '@/lib/engagementService';

interface QuestCardProps {
  quest: DailyQuest;
}

const QUEST_ICONS: Record<string, string> = {
  'Push-ups': '💪',
  'Sit-ups': '🔥',
  Squats: '🦵',
  Running: '🏃',
};

function DifficultyBadge({ multiplier }: { multiplier: number }) {
  const delta = multiplier - 1;
  if (Math.abs(delta) < 0.05) return null;
  const harder = delta > 0;
  const pct = Math.abs(Math.round(delta * 100));
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
        harder ? 'text-amber-400 bg-amber-400/10' : 'text-sky-400 bg-sky-400/10'
      }`}
    >
      {harder ? '↑' : '↓'} {pct}%
    </span>
  );
}

export default function QuestCard({ quest }: QuestCardProps) {
  const { updateProgress } = useQuests();
  const { refreshProfile } = useAuth();
  const [inputValue, setInputValue]     = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [reward, setReward]             = useState<RewardResult | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  const icon            = QUEST_ICONS[quest.title] || '⚡';
  const effectiveTarget = quest.currentTarget ?? quest.targetValue;
  const unit            = quest.title === 'Running' ? 'km' : 'reps';

  // Clear the float after its animation finishes (called via onAnimationComplete)
  function clearCompleted() {
    setJustCompleted(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    setSubmitting(true);
    try {
      const newValue = quest.currentValue + val;
      await updateProgress(quest.id, newValue);
      if (newValue >= effectiveTarget) {
        setJustCompleted(true);
        await refreshProfile();
        const result = triggerRandomReward(quest.xpReward);
        if (result.show) setReward(result);
      }
      setInputValue('');
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
          <span className="text-2xl">{icon}</span>
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

      {/* Input — hidden when complete */}
      <AnimatePresence>
        {!quest.completed && (
          <motion.form
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="flex gap-2 mt-4"
          >
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Add ${unit}`}
              className="flex-1 bg-subtle border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors min-h-[44px]"
            />
            <motion.button
              type="submit"
              disabled={submitting || !inputValue}
              whileTap={{ scale: 0.93 }}
              transition={{ duration: 0.1 }}
              className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
            >
              {submitting ? '…' : 'Log'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Strava sync — Running quest only, while incomplete */}
      {quest.title === 'Running' && !quest.completed && <StravaSyncButton />}

      {/* Bonus reward popup */}
      {reward && <RewardPopup reward={reward} onDismiss={() => setReward(null)} />}
    </motion.div>
  );
}
