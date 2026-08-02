'use client';

import { useEffect, useState } from 'react';

function getNextSaturday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const daysUntilSaturday = day === 6 ? 7 : 6 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilSaturday);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatCountdown(target: Date): string {
  const ms = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function NextBossCountdown() {
  const [label, setLabel] = useState(() => formatCountdown(getNextSaturday()));

  useEffect(() => {
    const interval = setInterval(() => setLabel(formatCountdown(getNextSaturday())), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <p className="text-[10px] text-muted uppercase tracking-widest mb-2">No entity detected</p>
      <p className="text-sm text-white">Weekend bosses spawn Saturday 00:00.</p>
      <p className="text-2xl font-bold text-white font-display mt-3">{label}</p>
      <p className="text-xs text-muted mt-1">until the next engagement window</p>
    </div>
  );
}
