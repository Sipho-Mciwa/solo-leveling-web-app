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
import { resolveAchievementName } from '@/utils/achievementMap';
import { generateLocalInsight } from '@/utils/systemVoice';
import SystemMessage from './SystemMessage';
import { classifyInsightTone, TONE_STYLES } from '@/utils/systemStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

const RANK_STYLES: Record<Rank, string> = {
  E: 'text-gray-400',
  D: 'text-green-400',
  C: 'text-blue-400',
  B: 'text-purple-400',
  A: 'text-yellow-400',
  S: 'text-red-400',
};

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
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [aiInsight,    setAiInsight]    = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchStats()           .then(setStats)       .catch(() => {});
    fetchTodayChallenges() .then(setChallenges)  .catch(() => {});
    fetchActivePenalty()   .then((r) => setPenalty(r.penalty)).catch(() => {});
    fetchRankProgress()    .then(setRankProgress).catch(() => {});
    fetchTodayQuests()
      .then((data) => { setQuests(data); setQuestsReady(true); })
      .catch(() => { setQuestsReady(true); });
    fetchAIInsight()       .then((r) => setAiInsight(r.insight)).catch(() => {});
  }, [firebaseUser]);

  if (!userProfile || !firebaseUser) return null;

  const { xp, level, streakCount, rank, activeTitle, titles } = userProfile;
  const { displayName, photoURL, email } = firebaseUser;

  const name         = displayName ?? email?.split('@')[0] ?? 'Hunter';
  const displayTitle     = pendingTitle ?? activeTitle;
  const displayTitleName = displayTitle ? resolveAchievementName(displayTitle) : null;
  const xpNeeded     = xpRequiredForLevel(level);
  const xpPct        = Math.min(100, xpNeeded > 0 ? (xp / xpNeeded) * 100 : 0);

  // ── Rank progress ─────────────────────────────────────────────────────────
  const rankMetCount   = rankProgress?.metCount   ?? 0;
  const rankTotalCount = rankProgress?.totalCount ?? 0;
  const rankNextRank   = rankProgress?.nextRank   ?? null;
  const rankPct        = rankTotalCount > 0 ? (rankMetCount / rankTotalCount) * 100 : 100;

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
  const showTitles      = (titles?.length ?? 0) > 1;
  const recentTitle     = (titles?.length ?? 0) > 1 ? titles[titles.length - 1] : null;
  const showAchievement = recentTitle && recentTitle !== 'E Rank Hunter';

  async function handleTitleSelect(title: string) {
    if (title === displayTitle) return;
    setPendingTitle(title);
    try {
      await setActiveTitle(title);
      await refreshProfile();
    } catch {
      setPendingTitle(null);
    } finally {
      setPendingTitle(null);
    }
  }

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

        <div className="flex items-center gap-2 mt-2">
          <RankBadge rank={rank ?? 'E'} size="md" />
          {displayTitleName && (
            <span className="text-xs text-muted italic">"{displayTitleName}"</span>
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
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold ${RANK_STYLES[rank ?? 'E']}`}>{rank}</span>
            <div className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${rankPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                style={{
                  background:
                    rankNextRank == null
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />
            </div>
            {rankNextRank && (
              <span className={`text-[11px] font-bold ${RANK_STYLES[rankNextRank]}`}>
                {rankNextRank}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted mt-1 text-right">
            {rankNextRank == null
              ? 'Max rank achieved'
              : rankProgress
              ? `${rankMetCount}/${rankTotalCount} conditions met for ${rankNextRank}-Rank`
              : `Working towards ${rankNextRank}-Rank`}
          </p>
          {/* Criteria breakdown */}
          {rankProgress && rankNextRank && rankProgress.criteria.length > 0 && (
            <div className="mt-2 space-y-1">
              {rankProgress.criteria.map((c) => (
                <div key={c.label} className="flex items-center justify-between text-[10px]">
                  <span className={c.met ? 'text-green-400' : 'text-muted'}>
                    {c.met ? '✓' : '·'} {c.label}
                  </span>
                  <span className={`tabular-nums ${c.met ? 'text-green-400' : 'text-muted'}`}>
                    {c.current}/{c.target}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
        className="px-4 sm:px-6 py-4 border-t border-border space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Pulse the count if streak is at risk (red) or on fire (purple) */}
            <motion.span
              className="text-sm font-bold text-white tabular-nums"
              animate={
                streakAtRisk
                  ? { opacity: [1, 0.45, 1] }
                  : streakCount >= 7
                  ? { scale: [1, 1.08, 1] }
                  : {}
              }
              transition={
                streakAtRisk || streakCount >= 7
                  ? { repeat: Infinity, duration: streakAtRisk ? 1.1 : 2.2 }
                  : {}
              }
            >
              <CountUp end={streakCount} duration={1.1} />
            </motion.span>
            <span className="text-xs text-muted">day streak</span>
          </div>

          <AnimatePresence mode="wait">
            {streakAtRisk ? (
              <motion.span
                key="risk"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
              >
                At risk
              </motion.span>
            ) : streakCount >= 7 ? (
              <motion.span
                key="fire"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                className="text-[10px] font-semibold text-accent-light bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5 uppercase tracking-wide"
              >
                On fire
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Penalty warning */}
        <AnimatePresence>
          {activePenalty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2"
            >
              <span className="text-xs font-semibold shrink-0">!</span>
              <p className="text-[11px] font-medium">
                Penalty active — complete it to restore rank progress
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time pressure (< 5h left + incomplete quests) */}
        <AnimatePresence>
          {showPressure && !activePenalty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-amber-400 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2"
            >
              <span className="text-xs shrink-0">⏱</span>
              <p className="text-[11px] font-medium">
                {hLeft}h {mLeft}m left today —{' '}
                {questsTotal - questsDone} quest
                {questsTotal - questsDone !== 1 ? 's' : ''} remaining
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
                  "{insightText}"
                </p>
              </SystemMessage>
            </>
          );
        })()}
      </motion.div>

      {/* ── 8. Title system ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTitles && (
          <motion.div
            key="titles"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, delay: 0.35 }}
            className="px-4 sm:px-6 py-4 border-t border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted uppercase tracking-widest">Titles</p>
              <Link href="/titles" className="text-[10px] text-accent-light/70 hover:text-accent-light transition-colors">
                View all →
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(titles ?? []).map((title) => {
                const isActive    = title === displayTitle;
                const displayName = resolveAchievementName(title);
                return (
                  <motion.button
                    key={title}
                    onClick={() => handleTitleSelect(title)}
                    whileTap={{ scale: 0.93 }}
                    transition={{ duration: 0.1 }}
                    className={`text-[11px] rounded-full px-3 py-1.5 border transition-colors duration-150 min-h-[34px] ${
                      isActive
                        ? 'bg-accent/20 border-accent/50 text-accent-light font-semibold'
                        : 'bg-transparent border-border text-muted hover:border-subtle hover:text-white'
                    }`}
                  >
                    {displayName}
                    {isActive && <span className="ml-1 opacity-60">·</span>}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted/60 mt-2">Tap a title to equip it</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
