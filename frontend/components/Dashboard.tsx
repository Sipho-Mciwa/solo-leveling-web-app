'use client';

import { useQuests } from '@/context/QuestContext';
import QuestCard from './QuestCard';

export default function Dashboard() {
  const { quests, loading, error } = useQuests();

  const completed = quests.filter((q) => q.completed).length;
  const total = quests.length;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      {/* Date + summary */}
      <div className="mb-8">
        <p className="text-muted text-xs tracking-wide uppercase">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h2 className="text-2xl font-bold text-white mt-1">Daily Quests</h2>
        {total > 0 && (
          <p className="text-muted text-sm mt-1">
            {completed}/{total} completed
          </p>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">
          {error}
        </div>
      )}

      {!loading && !error && quests.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          No quests today. Try refreshing.
        </div>
      )}

      {/* Quest grid */}
      {!loading && quests.length > 0 && (
        <div className="space-y-3">
          {quests.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </div>
      )}

      {/* All done state */}
      {!loading && total > 0 && completed === total && (
        <div className="mt-8 text-center">
          <p className="text-accent-light font-semibold">All quests complete.</p>
          <p className="text-muted text-sm mt-1">Come back tomorrow.</p>
        </div>
      )}
    </main>
  );
}
