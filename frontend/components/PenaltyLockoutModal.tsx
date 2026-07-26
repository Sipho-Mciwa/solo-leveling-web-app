'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { usePenalty } from '@/context/PenaltyContext';
import { updatePenaltyProgress } from '@/lib/api';
import ProgressBar from './ProgressBar';

// Full-screen, non-dismissible overlay — no backdrop click, no Escape key,
// no close button. It only unmounts once the penalty is logged to
// completion, which is the point: the app is unusable until it's cleared.
export default function PenaltyLockoutModal() {
  const { penalty, setPenalty } = usePenalty();
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!penalty || penalty.completed) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!penalty) return;
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;

    setSubmitting(true);
    try {
      const newValue = penalty.currentValue + val;
      const result = await updatePenaltyProgress(penalty.id, newValue);
      setPenalty({ ...penalty, currentValue: result.currentValue, completed: result.completed });
      setInputValue('');
    } catch (err) {
      console.error('Failed to update penalty:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full max-w-sm rounded-2xl border border-danger/40 bg-danger/5 p-5 shadow-2xl"
          style={{ boxShadow: '0 0 60px 8px rgba(248,113,113,0.15)' }}
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-danger" />
              <div>
                <p className="text-xs font-semibold text-danger uppercase tracking-wide">Penalty Quest</p>
                <h3 className="text-sm font-bold text-white mt-0.5">{penalty.title}</h3>
              </div>
            </div>
            <span className="text-xs text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
              −{penalty.xpPenalty} XP
            </span>
          </div>

          <p className="text-xs text-muted mb-3 leading-relaxed">{penalty.description}</p>

          <p className="text-[11px] text-danger/80 italic mb-4">
            System lockout active. Clear the protocol to resume access.
          </p>

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
              autoFocus
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
