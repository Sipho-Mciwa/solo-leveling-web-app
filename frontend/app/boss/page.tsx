'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useWeekendBoss } from '@/context/WeekendBossContext';
import { fetchWeekendBossHistory, WeekendBoss, WeekendBossStats } from '@/lib/api';
import Header from '@/components/Header';
import WeekendBossCard from '@/components/WeekendBossCard';
import WeekendBossHistory from '@/components/WeekendBossHistory';
import NextBossCountdown from '@/components/NextBossCountdown';
import LoadingScreen from '@/components/LoadingScreen';

export default function BossPage() {
  const { firebaseUser, loading: authLoading } = useRequireAuth();
  const { boss, loading: bossLoading, setBoss } = useWeekendBoss();

  const [history, setHistory] = useState<WeekendBoss[]>([]);
  const [stats, setStats] = useState<WeekendBossStats>({ defeated: 0, missed: 0, currentStreak: 0 });

  useEffect(() => {
    if (!firebaseUser) return;
    fetchWeekendBossHistory()
      .then((r) => { setHistory(r.history); setStats(r.stats); })
      .catch(() => {});
  }, [firebaseUser, boss?.status]);

  if (authLoading || !firebaseUser) return <LoadingScreen />;

  const actionable = boss && (boss.status === 'active' || boss.status === 'completed');

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <p className="text-muted text-xs tracking-wide uppercase">Weekly Event</p>
          <h2 className="text-2xl font-bold text-white mt-1">Weekend Boss</h2>
        </div>

        {bossLoading && (
          <div className="h-48 rounded-2xl bg-surface border border-border animate-pulse" />
        )}

        {!bossLoading && actionable && boss && (
          <WeekendBossCard boss={boss} onUpdate={setBoss} />
        )}

        {!bossLoading && !actionable && <NextBossCountdown />}

        <WeekendBossHistory history={history} stats={stats} />
      </main>
    </div>
  );
}
