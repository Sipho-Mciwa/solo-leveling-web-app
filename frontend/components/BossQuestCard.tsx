'use client';

import { BossQuest } from '@/lib/api';
import ProgressBar from './ProgressBar';

interface BossQuestCardProps {
  boss: BossQuest;
  onUpdate: (updated: BossQuest) => void;
}

export default function BossQuestCard({ boss }: BossQuestCardProps) {
  const pctDone   = Math.round((boss.currentValue / boss.targetValue) * 100);
  const diffLabel = boss.difficulty > 1 ? `×${boss.difficulty.toFixed(1)}` : 'Base';

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

      {boss.completed ? (
        <p className="text-center text-sm text-yellow-400 font-semibold mt-4">
          Boss defeated. XP claimed.
        </p>
      ) : (
        <p className="text-[11px] text-muted mt-4 text-center">
          Progress updates automatically as you log your daily quests.
        </p>
      )}
    </div>
  );
}
