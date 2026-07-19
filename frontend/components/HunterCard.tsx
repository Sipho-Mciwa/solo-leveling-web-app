'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  fetchStats,
  fetchTodayQuests,
  fetchTodayChallenges,
  fetchActivePenalty,
  fetchRankProgress,
  fetchAIInsight,
  setActiveTitle,
  HunterStats,
  DailyQuest,
  DailyChallengesDoc,
  PenaltyQuest,
  RankProgress,
  Rank,
} from '@/lib/api';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import ProfileAvatar from './ProfileAvatar';
import RankBadge from './RankBadge';
import StatsRadarChart from './StatsRadarChart';
import RankProgressBar from './RankProgressBar';
import StreakPanel from './StreakPanel';
import { resolveAchievementName } from '@/utils/achievementMap';
import { generateLocalInsight } from '@/utils/systemVoice';
import SystemMessage from './SystemMessage';
import { classifyInsightTone, TONE_STYLES } from '@/utils/systemStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

// ─── Animation variants ───────────────────────────────────────────────────────

const sectionVariant = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' as const, delay } },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAT_KEYS: StatKey[] = ['PHY', 'SPD', 'STAMINA', 'DISCIPLINE', 'INTELLECT'];

function getWeakestStat(stats: HunterStats): StatKey {
  return STAT_KEYS.reduce((a, b) => (stats[a] < stats[b] ? a : b));
}


// ─── Component ────────────────────────────────────────────────────────────────

export default function HunterCard() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();

  const [stats,        setStats]        = useState<HunterStats | null>(null);
  const [quests,       setQuests]       = useState<DailyQuest[]>([]);
  const [challenges,   setChallenges]   = useState<DailyChallengesDoc | null>(null);
  const [penalty,      setPenalty]      = useState<PenaltyQuest | null>(null);
  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);
  const [questsReady,  setQuestsReady]  = useState(false);
  const [aiInsight,    setAiInsight]    = useState<string | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;

    // AI insight has its own local fallback (`insight` below), so a failure
    // there is expected/non-critical and stays silent. The rest are surfaced
    // as a single banner instead of failing silently — a partial data load
    // (e.g. stats endpoint down) previously just rendered "—" forever with
    // no indication anything was wrong.
    const trackedLoads: Array<[string, Promise<unknown>]> = [
      ['stats',       fetchStats().then(setStats)],
      ['challenges',  fetchTodayChallenges().then(setChallenges)],
      ['penalty',     fetchActivePenalty().then((r) => setPenalty(r.penalty))],
      ['rank progress', fetchRankProgress().then(setRankProgress)],
      ['quests',      fetchTodayQuests().then((data) => { setQuests(data); setQuestsReady(true); })],
    ];

    fetchAIInsight().then((r) => setAiInsight(r.insight)).catch(() => {});

    Promise.allSettled(trackedLoads.map(([, p]) => p)).then((results) => {
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? trackedLoads[i][0] : null))
        .filter((x): x is string => x !== null);

      if (failed.includes('quests')) setQuestsReady(true);
      if (failed.length > 0) {
        setLoadError(`Some data failed to load (${failed.join(', ')}). Try refreshing.`);
      }
    });
  }, [firebaseUser]);

  if (!userProfile || !firebaseUser) return null;

  const { xp, level, streakCount, rank, activeTitle, titles } = userProfile;
  const { displayName, photoURL, email } = firebaseUser;

  const name             = displayName ?? email?.split('@')[0] ?? 'Hunter';
  const displayTitleName = activeTitle ? resolveAchievementName(activeTitle) : null;
  const xpNeeded     = xpRequiredForLevel(level);
  const xpPct        = Math.min(100, xpNeeded > 0 ? (xp / xpNeeded) * 100 : 0);

  // ── Daily snapshot ────────────────────────────────────────────────────────
  const questsDone      = quests.filter((q) => q.completed).length;
  const questsTotal     = quests.length;
  const challengesDone  = challenges?.challenges.filter((c) => c.completed).length ?? 0;
  const challengesTotal = challenges?.challenges.length ?? 0;

  // ── Next objective ────────────────────────────────────────────────────────
  const nextQuest     = quests.find((q) => !q.completed) ?? null;
  const nextTarget    = nextQuest ? (nextQuest.currentTarget ?? nextQuest.targetValue) : 0;
  const nextRemaining = nextQuest ? Math.max(0, nextTarget - nextQuest.currentValue) : 0;

  // ── Streak & pressure ────────────────────────────────────────────────────
  const streakAtRisk = streakCount > 0 && questsReady && questsTotal > 0 && questsDone === 0;

  const now      = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const hoursLeft    = (midnight.getTime() - now.getTime()) / 3_600_000;
  const showPressure = questsReady && questsTotal > 0 && questsDone < questsTotal && hoursLeft < 5;
  const hLeft        = Math.floor(hoursLeft);
  const mLeft        = Math.floor((hoursLeft - hLeft) * 60);

  const activePenalty = penalty && !penalty.completed && !penalty.expired;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const weakestStat: StatKey | null = stats ? getWeakestStat(stats) : null;
  const insight = generateLocalInsight(stats, streakCount, questsDone, questsTotal);

  // ── Titles ────────────────────────────────────────────────────────────────
  const recentTitle     = (titles?.length ?? 0) > 1 ? titles[titles.length - 1] : null;
  const showAchievement = recentTitle && recentTitle !== 'E Rank Hunter';

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">

      {/* ── 1. Identity ─────────────────────────────────────────────────────── */}
      <motion.div
        {...sectionVariant(0)}
        className="flex flex-col items-center text-center px-4 sm:px-6 pt-8 pb-6"
      >
        <ProfileAvatar photoURL={photoURL} displayName={displayName} email={email} />

        <AnimatePresence>
          {showAchievement && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
              className="mt-3 inline-flex items-center gap-1.5 bg-green-400/10 border border-green-400/20 rounded-full px-3 py-0.5"
            >
              <span className="text-[9px] font-semibold uppercase tracking-widest text-green-400">
                Achievement
              </span>
              <span className="text-[10px] text-green-300">{resolveAchievementName(recentTitle ?? '')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="text-lg font-bold text-white leading-tight mt-3">{name}</h1>

        {loadError && (
          <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1 mt-2">
            {loadError}
          </p>
        )}

        <div className="flex items-center gap-2 mt-2">
          <RankBadge rank={rank ?? 'E'} size="md" />
          {displayTitleName && (
            <span className="text-xs text-muted italic">&quot;{displayTitleName}&quot;</span>
          )}
        </div>
      </motion.div>

      {/* ── 2. XP bar + Rank progress ────────────────────────────────────────── */}
      <motion.div
        {...sectionVariant(0.07)}
        className="px-4 sm:px-6 pb-5 space-y-4"
      >
        {/* XP bar */}
        <div>
          <div className="flex justify-between text-[11px] text-muted mb-1.5">
            <span>
              Level{' '}
              <CountUp end={level} duration={0.8} className="text-white font-semibold" />
            </span>
            <span className="tabular-nums">
              <CountUp end={xp} duration={1.4} separator="," /> / {xpNeeded.toLocaleString()} XP
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
              style={{
                // Subtle glow when nearly full
                boxShadow: xpPct >= 85 ? '0 0 8px 2px rgba(124, 58, 237, 0.55)' : undefined,
              }}
            />
          </div>
          <p className="text-[10px] text-muted mt-1 text-right">
            {Math.round(100 - xpPct)}% to Level {level + 1}
          </p>
        </div>

        {/* Rank progress — criteria-based */}
        <RankProgressBar rank={rank ?? 'E'} rankProgress={rankProgress} variant="full" />
      </motion.div>

      {/* ── 3. Daily snapshot ────────────────────────────────────────────────── */}
      <motion.div
        {...sectionVariant(0.14)}
        className="grid grid-cols-2 border-t border-border divide-x divide-border"
      >
        <div className="px-4 py-3 text-center">
          <p className="text-base font-bold text-white tabular-nums leading-none">
            {questsReady ? `${questsDone}/${questsTotal}` : '—'}
          </p>
          <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Quests</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-base font-bold text-white tabular-nums leading-none">
            {challenges ? `${challengesDone}/${challengesTotal}` : '—'}
          </p>
          <p className="text-[10px] text-muted mt-1 uppercase tracking-wide">Challenges</p>
        </div>
      </motion.div>

      {/* ── 4. Next objective ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {questsReady && nextQuest && (
          <motion.div
            key="next-obj"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="px-4 sm:px-6 py-4 border-t border-border"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
                  Next objective
                </p>
                <p className="text-sm font-semibold text-white truncate">{nextQuest.title}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted mb-1">&nbsp;</p>
                <p className="text-xs text-accent-light tabular-nums">
                  {nextQuest.currentValue} / {nextTarget}
                </p>
              </div>
            </div>
            <div className="mt-2 h-1 rounded-full bg-subtle overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent/60"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (nextQuest.currentValue / nextTarget) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-muted mt-1">
              {nextRemaining}{' '}
              {nextQuest.title.toLowerCase().includes('run') ? 'km' : 'reps'} remaining
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Streak + pressure ─────────────────────────────────────────────── */}
      <motion.div
        {...sectionVariant(0.21)}
        className="px-4 sm:px-6 py-4 border-t border-border"
      >
        <StreakPanel
          streakCount={streakCount}
          streakAtRisk={streakAtRisk}
          activePenalty={!!activePenalty}
          showPressure={showPressure}
          hoursLeft={hLeft}
          minutesLeft={mLeft}
          questsRemaining={questsTotal - questsDone}
          variant="full"
        />
      </motion.div>

      {/* ── 6. Stats radar chart ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {stats && (
          <motion.div
            key="stats-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <StatsRadarChart stats={stats} weakestStat={weakestStat} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 7. AI insight ────────────────────────────────────────────────────── */}
      <motion.div
        {...sectionVariant(0.28)}
        className="px-4 sm:px-6 py-4 border-t border-border"
      >
        {(() => {
          const insightText = aiInsight ?? insight;
          const tone        = classifyInsightTone(insightText);
          return (
            <>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] text-muted uppercase tracking-widest">
                  {aiInsight ? 'AI Coach' : 'Insight'}
                </p>
                {aiInsight && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-accent-light/60 bg-accent/10 border border-accent/20 rounded-full px-1.5 py-0.5">
                    AI
                  </span>
                )}
              </div>
              <SystemMessage tone={tone} className="p-3">
                <p className={`text-xs leading-relaxed italic ${TONE_STYLES[tone].text}`}>
                  &quot;{insightText}&quot;
                </p>
              </SystemMessage>
            </>
          );
        })()}
      </motion.div>

    </div>
  );
}
