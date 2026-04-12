'use client';

interface ProgressBarProps {
  current: number;
  target: number;
  color?: string;
}

export default function ProgressBar({ current, target, color = 'bg-accent' }: ProgressBarProps) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);

  return (
    <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
