'use client';

import { useState } from 'react';
import { BossQuest, updateBossProgress } from '@/lib/api';
import ProgressBar from './ProgressBar';
import { useAuth } from '@/context/AuthContext';

interface BossQuestCardProps {
  boss: BossQuest;
  onUpdate: (updated: BossQuest) => void;
}

export default function BossQuestCard({ boss, onUpdate }: BossQuestCardProps) {
  const { refreshProfile } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pctDone    = Math.round((boss.currentValue / boss.targetValue) * 100);
  const diffLabel  = boss.difficulty > 1 ? `×${boss.difficulty.toFixed(1)}` : 'Base';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    setSubmitting(true);
    try {
      const newValue = boss.currentValue + val;
      const result   = await updateBossProgress(boss.id, newValue);
      onUpdate({ ...boss, currentValue: result.currentValue, completed: result.completed });
      if (result.completed) await refreshProfile();
      setInputValue('');
    } catch (err) {
      console.error('Failed to update boss:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 mb-4 ${
        boss.completed
          ? 'border-yellow-500/40 bg-yellow-500/5'
          : 'border-yellow-600/30 bg-yellow-900/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">👹</span>
          <div>
            <p className="text-[10px] font-semibold text-yellow-500 uppercase tracking-widest">
              Weekly Boss
            </p>
            <h3 className="text-sm font-bold text-white mt-0.5">{boss.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-yellow-500/70 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
            {diffLabel} difficulty
          </span>
          {boss.completed && (
            <span className="text-xs font-medium text-yellow-400 bg-yellow-400/15 px-2 py-0.5 rounded-full">
              Defeated
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted mt-2 mb-4 leading-relaxed">{boss.description}</p>

      {/* XP reward */}
      <p className="text-xs text-yellow-500/80 mb-3">+{boss.xpReward} XP on defeat</p>

      {/* Progress */}
      <div className="flex justify-between text-xs text-muted mb-1.5">
        <span>{boss.currentValue} / {boss.targetValue} {boss.unit}</span>
        <span>{pctDone}%</span>
      </div>
      <ProgressBar current={boss.currentValue} target={boss.targetValue} color="bg-yellow-500" />

      {/* Input */}
      {!boss.completed && (
        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <input
            type="number"
            min="0"
            step="0.1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Add ${boss.unit}`}
            className="flex-1 bg-subtle border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-yellow-600 transition-colors"
          />
          <button
            type="submit"
            disabled={submitting || !inputValue}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? '...' : 'Strike'}
          </button>
        </form>
      )}

      {boss.completed && (
        <p className="text-center text-sm text-yellow-400 font-semibold mt-4">
          Boss defeated. XP claimed.
        </p>
      )}
    </div>
  );
}
