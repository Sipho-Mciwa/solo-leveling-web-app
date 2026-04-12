'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchQuestHistory, QuestHistoryRow } from '@/lib/api';
import Header from '@/components/Header';
import DashboardTable from '@/components/DashboardTable';

function formatDisplayMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [quests, setQuests] = useState<QuestHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.push('/login');
  }, [authLoading, firebaseUser, router]);

  const loadHistory = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuestHistory(month);
      setQuests(data.quests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, month]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (authLoading || !firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Monthly Overview</p>
            <h2 className="text-2xl font-bold text-white mt-1">{formatDisplayMonth(month)}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={month >= currentMonth}
              className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">
            {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <DashboardTable quests={quests} month={month} />
        )}
      </main>
    </div>
  );
}
