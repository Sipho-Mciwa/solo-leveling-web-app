'use client';

import { useQuests } from '@/context/QuestContext';
import UrgencyBanner from './UrgencyBanner';
import ChallengeSection from './ChallengeSection';
import QuestSection from './QuestSection';
import DailySummaryPanel from './DailySummaryPanel';
import DailySnapshot from './DailySnapshot';

export default function Dashboard() {
  const { quests } = useQuests();

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <UrgencyBanner quests={quests} />

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
