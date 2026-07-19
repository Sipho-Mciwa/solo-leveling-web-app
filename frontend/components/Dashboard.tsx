'use client';

import { useEffect, useState } from 'react';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import {
  fetchActivePenalty,
  fetchWeekendBoss,
  generateWeekendBoss,
  PenaltyQuest,
  WeekendBoss,
} from '@/lib/api';
import PenaltyAlert from './PenaltyAlert';
import WeekendBossCard from './WeekendBossCard';
import UrgencyBanner from './UrgencyBanner';
import ChallengeSection from './ChallengeSection';
import QuestSection from './QuestSection';
import DailySummaryPanel from './DailySummaryPanel';
import StatusStrip from './StatusStrip';
import DailySnapshot from './DailySnapshot';

export default function Dashboard() {
  const { quests } = useQuests();
  const { firebaseUser } = useAuth();

  const [penalty,     setPenalty]     = useState<PenaltyQuest | null>(null);
  const [weekendBoss, setWeekendBoss] = useState<WeekendBoss | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchActivePenalty().then((r) => setPenalty(r.penalty)).catch(() => {});

    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      generateWeekendBoss()
        .then((r) => setWeekendBoss(r.boss ?? null))
        .catch(() => fetchWeekendBoss().then((r) => setWeekendBoss(r.boss)).catch(() => {}));
    }
  }, [firebaseUser]);

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      {/* ── Alert layer — unconditional, above everything else ── */}
      {penalty && !penalty.completed && (
        <PenaltyAlert penalty={penalty} onUpdate={setPenalty} />
      )}
      {weekendBoss && (
        <WeekendBossCard boss={weekendBoss} onUpdate={setWeekendBoss} />
      )}
      <UrgencyBanner quests={quests} />

      {/* ── Status strip ── */}
      <StatusStrip />

      {/* ── Daily board ── */}
      <div className="mb-6">
        <p className="text-muted text-xs tracking-wide uppercase">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h2 className="text-2xl font-bold text-white mt-1">Daily Board</h2>
      </div>

      <DailySnapshot />
      <DailySummaryPanel />
      <ChallengeSection />

      <div className="border-t border-border/40 my-6" />

      <QuestSection />
    </main>
  );
}
