'use client';

import { AnalyticsOverview } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface StatCardsProps {
  overview: AnalyticsOverview;
  totalQuestsDone: number;
}

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-5 py-4">
      <p className="text-xs text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl font-bold text-white leading-none">{value}</p>
      {sub && <p className="text-xs text-muted mt-1.5">{sub}</p>}
    </div>
  );
}

export default function StatCards({ overview, totalQuestsDone }: StatCardsProps) {
  const { userProfile } = useAuth();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        label="Avg completion"
        value={`${overview.overallCompletionRate}%`}
        sub="last 30 days"
      />
      <Card
        label="Active days"
        value={overview.activeDays}
        sub="out of 30 days"
      />
      <Card
        label="Current streak"
        value={userProfile?.streakCount ?? 0}
        sub="consecutive days"
      />
      <Card
        label="Quests done"
        value={totalQuestsDone}
        sub="last 30 days"
      />
    </div>
  );
}
