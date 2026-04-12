'use client';

import { useState } from 'react';
import { DailyQuest } from '@/lib/api';
import ProgressBar from './ProgressBar';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';

interface QuestCardProps {
  quest: DailyQuest;
}

const QUEST_ICONS: Record<string, string> = {
  'Push-ups': '💪',
  Squats: '🦵',
  Running: '🏃',
};

export default function QuestCard({ quest }: QuestCardProps) {
  const { updateProgress, refresh } = useQuests();
  const { refreshProfile } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const icon = QUEST_ICONS[quest.title] || '⚡';
  const pct = Math.min(100, quest.targetValue > 0 ? (quest.currentValue / quest.targetValue) * 100 : 0);

  const unit = quest.title === 'Running' ? 'km' : 'reps';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    setSubmitting(true);
    try {
      await updateProgress(quest.id, quest.currentValue + val);
      // If just completed, refresh profile for updated XP/streak
      if (quest.currentValue + val >= quest.targetValue) {
        await refreshProfile();
      }
      setInputValue('');
    } catch (err) {
      console.error('Failed to update progress:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        quest.completed
          ? 'border-accent/40 bg-accent/5'
          : 'border-border bg-surface'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-white text-sm">{quest.title}</h3>
            <p className="text-xs text-muted mt-0.5">+{quest.xpReward} XP</p>
          </div>
        </div>
        {quest.completed ? (
          <span className="text-xs font-medium text-accent-light bg-accent/20 px-2 py-0.5 rounded-full">
            Done
          </span>
        ) : (
          <span className="text-xs text-muted">
            {quest.currentValue}/{quest.targetValue} {unit}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar
        current={quest.currentValue}
        target={quest.targetValue}
        color={quest.completed ? 'bg-accent-light' : 'bg-accent'}
      />

      {/* Input — hidden when complete */}
      {!quest.completed && (
        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <input
            type="number"
            min="0"
            step="0.1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Add ${unit}`}
            className="flex-1 bg-subtle border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={submitting || !inputValue}
            className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? '...' : 'Log'}
          </button>
        </form>
      )}
    </div>
  );
}
