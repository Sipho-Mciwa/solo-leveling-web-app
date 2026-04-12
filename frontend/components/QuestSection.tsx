'use client';

import { useQuests } from '@/context/QuestContext';
import QuestCard from './QuestCard';

export default function QuestSection() {
  const { quests, loading, error } = useQuests();

  const completed = quests.filter((q) => q.completed).length;
  const total = quests.length;

  return (
    <section>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Daily Quests</h2>
          {total > 0 && (
            <p className="text-muted text-xs mt-0.5">
              {completed}/{total} completed
            </p>
          )}
        </div>
        {total > 0 && (
          <p className="text-accent-light text-sm font-semibold">
            {quests.filter((q) => q.completed).reduce((s, q) => s + q.xpReward, 0)} XP
          </p>
        )}
      </div>

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
        <div className="text-center py-8 text-muted text-sm">
          No quests today. Try refreshing.
        </div>
      )}

      {!loading && quests.length > 0 && (
        <div className="space-y-3">
          {quests.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </div>
      )}

      {!loading && total > 0 && completed === total && (
        <p className="mt-4 text-center text-sm text-accent-light font-semibold">
          All quests complete.
        </p>
      )}
    </section>
  );
}
