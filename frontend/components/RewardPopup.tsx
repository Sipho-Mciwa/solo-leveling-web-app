'use client';

import { useEffect, useState } from 'react';
import { RewardResult } from '@/lib/engagementService';

interface RewardPopupProps {
  reward: RewardResult;
  onDismiss: () => void;
}

export default function RewardPopup({ reward, onDismiss }: RewardPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    const enterTimer = requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 2.5s
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for exit transition
    }, 2500);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-surface border border-accent/40 rounded-2xl px-6 py-4 shadow-xl shadow-black/40 text-center min-w-[220px]">
        <p className="text-[10px] font-bold tracking-widest text-accent-light uppercase mb-1">
          {reward.label}
        </p>
        <p className="text-lg font-bold text-white">+{reward.xp} XP</p>
        <p className="text-xs text-muted mt-1">{reward.message}</p>
      </div>
    </div>
  );
}
