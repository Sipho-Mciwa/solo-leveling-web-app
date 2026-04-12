'use client';

import { useEffect, useState } from 'react';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import { fetchActivePenalty, fetchCurrentBoss, PenaltyQuest, BossQuest } from '@/lib/api';
import QuestCard from './QuestCard';
import PenaltyAlert from './PenaltyAlert';
import BossQuestCard from './BossQuestCard';
import RewardsPanel from './RewardsPanel';
import UrgencyBanner from './UrgencyBanner';

export default function Dashboard() {
  const { quests, loading, error } = useQuests();
  const { firebaseUser } = useAuth();

  const [penalty, setPenalty] = useState<PenaltyQuest | null>(null);
  const [boss, setBoss]       = useState<BossQuest | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchActivePenalty().then((r) => setPenalty(r.penalty)).catch(() => {});
    fetchCurrentBoss().then((r) => setBoss(r.boss)).catch(() => {});
  }, [firebaseUser]);

  const completed = quests.filter((q) => q.completed).length;
  const total = quests.length;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      {/* Penalty alert — shown above everything else */}
      {penalty && !penalty.completed && (
        <PenaltyAlert penalty={penalty} onUpdate={setPenalty} />
      )}

      {/* Boss quest */}
      {boss && (
        <BossQuestCard boss={boss} onUpdate={setBoss} />
      )}

      {/* Urgency banner — shows when quests are incomplete */}
      <UrgencyBanner quests={quests} />

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

      {/* Rank & titles */}
      <RewardsPanel />
    </main>
  );
}
