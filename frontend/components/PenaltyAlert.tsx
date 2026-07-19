'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PenaltyQuest, updatePenaltyProgress } from '@/lib/api';
import ProgressBar from './ProgressBar';

interface PenaltyAlertProps {
  penalty: PenaltyQuest;
  onUpdate: (updated: PenaltyQuest) => void;
}

export default function PenaltyAlert({ penalty, onUpdate }: PenaltyAlertProps) {
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (penalty.completed) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    setSubmitting(true);
    try {
      const newValue = penalty.currentValue + val;
      const result   = await updatePenaltyProgress(penalty.id, newValue);
      onUpdate({ ...penalty, currentValue: result.currentValue, completed: result.completed });
      setInputValue('');
    } catch (err) {
      console.error('Failed to update penalty:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/5 p-5 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-danger" />
          <div>
            <p className="text-xs font-semibold text-danger uppercase tracking-wide">Penalty Quest</p>
            <h3 className="text-sm font-bold text-white mt-0.5">{penalty.title}</h3>
          </div>
        </div>
        <span className="text-xs text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full">
          −{penalty.xpPenalty} XP if missed
        </span>
      </div>

      <p className="text-xs text-muted mb-3 leading-relaxed">{penalty.description}</p>

      {/* Progress */}
      <div className="flex justify-between text-xs text-muted mb-1.5">
        <span>{penalty.currentValue} / {penalty.targetValue} {penalty.unit}</span>
        <span>{Math.round((penalty.currentValue / penalty.targetValue) * 100)}%</span>
      </div>
      <ProgressBar current={penalty.currentValue} target={penalty.targetValue} color="bg-danger" />

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
        <input
          type="number"
          min="0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Add ${penalty.unit}`}
          className="flex-1 bg-subtle border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-danger transition-colors"
        />
        <button
          type="submit"
          disabled={submitting || !inputValue}
          className="px-4 py-2 bg-danger hover:bg-danger/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? '...' : 'Log'}
        </button>
      </form>
    </div>
  );
}
