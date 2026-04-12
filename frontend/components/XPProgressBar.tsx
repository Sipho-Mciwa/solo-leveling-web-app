interface XPProgressBarProps {
  xp: number;
  level: number;
  xpNeeded: number;
}

export default function XPProgressBar({ xp, level, xpNeeded }: XPProgressBarProps) {
  const pct = Math.min(100, xpNeeded > 0 ? (xp / xpNeeded) * 100 : 0);

  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-2">
        <span>Level {level}</span>
        <span>{xp.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
      </div>
      <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted mt-1.5 text-right">
        {Math.round(100 - pct)}% to Level {level + 1}
      </p>
    </div>
  );
}
