'use client';

import { WeekendBoss, WeekendBossStats } from '@/lib/api';

interface Props {
  history: WeekendBoss[];
  stats: WeekendBossStats;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  claimed:   { label: 'Defeated', className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25' },
  expired:   { label: 'Missed',   className: 'text-gray-500 bg-gray-500/10 border-gray-500/25' },
  completed: { label: 'Unclaimed', className: 'text-green-400 bg-green-400/10 border-green-400/25' },
  active:    { label: 'Live',     className: 'text-red-400 bg-red-400/10 border-red-400/25' },
};

function formatWeekendId(weekendId: string) {
  const [year, month, day] = weekendId.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function WeekendBossHistory({ history, stats }: Props) {
  return (
    <div className="mt-8">
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
          <p className="text-lg font-bold text-yellow-400">{stats.defeated}</p>
          <p className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Defeated</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
          <p className="text-lg font-bold text-gray-400">{stats.missed}</p>
          <p className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Missed</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center">
          <p className="text-lg font-bold text-red-400">{stats.currentStreak}</p>
          <p className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Streak</p>
        </div>
      </div>

      {/* ── History list ──────────────────────────────────────────────────── */}
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Past Encounters</h3>
      {history.length === 0 ? (
        <p className="text-sm text-muted">No past weekend bosses yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((boss) => {
            const config = STATUS_CONFIG[boss.status] ?? STATUS_CONFIG.expired;
            return (
              <div
                key={boss.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{boss.title}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatWeekendId(boss.weekendId)}
                    {boss.status === 'claimed' && ` · +${boss.xpReward + (boss.bonusXp ?? 0)} XP`}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${config.className}`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
