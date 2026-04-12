'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsQuests,
  fetchAnalyticsHeatmap,
  AnalyticsOverview,
  QuestStat,
  HeatmapEntry,
} from '@/lib/api';
import Header from '@/components/Header';
import StatCards from '@/components/analytics/StatCards';
import CompletionChart from '@/components/analytics/CompletionChart';
import QuestBreakdown from '@/components/analytics/QuestBreakdown';
import HeatmapGrid from '@/components/analytics/HeatmapGrid';
import InsightsPanel from '@/components/analytics/InsightsPanel';

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface border border-border" />)}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-52 rounded-2xl bg-surface border border-border" />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [quests, setQuests] = useState<QuestStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.push('/login');
  }, [authLoading, firebaseUser, router]);

  useEffect(() => {
    if (!firebaseUser) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch all three in parallel
        const [overviewData, questsData, heatmapData] = await Promise.all([
          fetchAnalyticsOverview(),
          fetchAnalyticsQuests(),
          fetchAnalyticsHeatmap(),
        ]);
        setOverview(overviewData);
        setQuests(questsData.quests);
        setHeatmap(heatmapData.data);
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
      </main>
    </div>
  );
}
