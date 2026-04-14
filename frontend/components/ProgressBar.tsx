'use client';

import { useEffect, useState } from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  color?: string;
}

export default function ProgressBar({ current, target, color = 'bg-accent' }: ProgressBarProps) {
  const targetPct = Math.min(100, target > 0 ? (current / target) * 100 : 0);

  // Start at 0 on mount so the bar fills in — gives every load a sense of progress
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(targetPct));
    return () => cancelAnimationFrame(id);
  }, [targetPct]);

  return (
    <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-[width] duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
