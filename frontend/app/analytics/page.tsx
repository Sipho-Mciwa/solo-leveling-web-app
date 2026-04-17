'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsQuests,
  fetchAnalyticsHeatmap,
  fetchRunningAnalytics,
  AnalyticsOverview,
  QuestStat,
  HeatmapEntry,
  RunningAnalytics,
} from '@/lib/api';
import Header from '@/components/Header';
import StatCards from '@/components/analytics/StatCards';
import CompletionChart from '@/components/analytics/CompletionChart';
import QuestBreakdown from '@/components/analytics/QuestBreakdown';
import HeatmapGrid from '@/components/analytics/HeatmapGrid';
import InsightsPanel from '@/components/analytics/InsightsPanel';
import PaceChart from '@/components/analytics/PaceChart';
import DistanceChart from '@/components/analytics/DistanceChart';
import RunningInsightsPanel from '@/components/analytics/RunningInsightsPanel';

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface border border-border" />)}
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-52 rounded-2xl bg-surface border border-border" />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [overview,  setOverview]  = useState<AnalyticsOverview | null>(null);
  const [quests,    setQuests]    = useState<QuestStat[]>([]);
  const [heatmap,   setHeatmap]   = useState<HeatmapEntry[]>([]);
  const [running,   setRunning]   = useState<RunningAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.push('/login');
  }, [authLoading, firebaseUser, router]);

  useEffect(() => {
    if (!firebaseUser) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [overviewData, questsData, heatmapData, runningData] = await Promise.all([
          fetchAnalyticsOverview(),
          fetchAnalyticsQuests(),
          fetchAnalyticsHeatmap(),
          fetchRunningAnalytics(),
        ]);
        setOverview(overviewData);
        setQuests(questsData.quests);
        setHeatmap(heatmapData.data);
        setRunning(runningData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [firebaseUser]);

  if (authLoading || !firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  const totalQuestsDone = quests.reduce((s, q) => s + q.completedDays, 0);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ── General analytics ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-muted text-xs tracking-wide uppercase">Last 30 days</p>
          <h2 className="text-2xl font-bold text-white mt-1">Analytics</h2>
        </div>

        {loading && <Skeleton />}

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">
            {error}
          </div>
        )}

        {!loading && !error && overview && (
          <div className="space-y-4">
            <StatCards overview={overview} totalQuestsDone={totalQuestsDone} />
            <CompletionChart dailyRates={overview.dailyRates} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuestBreakdown quests={quests} />
              <InsightsPanel insights={overview.insights} />
            </div>
            <HeatmapGrid data={heatmap} />
          </div>
        )}

        {/* ── Running performance ───────────────────────────────────────────── */}
        {!loading && !error && running && (
          <>
            <div className="mt-12 mb-6">
              <div className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FC4C02" aria-hidden="true">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                <p className="text-muted text-xs tracking-wide uppercase">Strava · Last 30 days</p>
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">Running Performance</h2>
            </div>

            <div className="space-y-4">
              <RunningInsightsPanel analytics={running} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaceChart data={running.paceTrend} avgPaceLabel={running.avgPaceLabel} />
                <DistanceChart data={running.weeklyData} />
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
