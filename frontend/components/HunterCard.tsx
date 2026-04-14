'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useAuth } from '@/context/AuthContext';
import {
  fetchStats,
  fetchTodayQuests,
  fetchTodayChallenges,
  fetchActivePenalty,
  setActiveTitle,
  HunterStats,
  DailyQuest,
  DailyChallengesDoc,
  PenaltyQuest,
  Rank,
} from '@/lib/api';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import ProfileAvatar from './ProfileAvatar';
import RankBadge from './RankBadge';
import StatsRadarChart from './StatsRadarChart';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatKey = 'PHY' | 'SPD' | 'STAMINA' | 'DISCIPLINE' | 'INTELLECT';

// ─── Rank progression (mirrors backend rankService.js) ────────────────────────

const RANK_CHAIN: { rank: Rank; min: number; next: Rank | null; nextMin: number | null }[] = [
  { rank: 'E', min: 0,  next: 'D', nextMin: 6  },
  { rank: 'D', min: 6,  next: 'C', nextMin: 15 },
  { rank: 'C', min: 15, next: 'B', nextMin: 30 },
  { rank: 'B', min: 30, next: 'A', nextMin: 50 },
  { rank: 'A', min: 50, next: 'S', nextMin: 80 },
  { rank: 'S', min: 80, next: null, nextMin: null },
];

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

function generateInsight(
  stats: HunterStats | null,
  streakCount: number,
  questsDone: number,
  questsTotal: number,
): string {
  if (!stats) return 'Log your daily quests to build your hunter profile.';
  const entries = STAT_KEYS.map((k) => ({ key: k, val: stats[k] }));
  const weakest = entries.reduce((a, b) => (a.val < b.val ? a : b));
  const avg     = entries.reduce((s, e) => s + e.val, 0) / 5;
  if (weakest.val < 20)
    return `${weakest.key} is critically low. Even five minutes a day compounds over 14 days.`;
  if (stats.DISCIPLINE >= 85)
    return 'Your discipline is elite. That consistency separates hunters from the rest.';
  if (avg >= 75)
    return 'Balanced and powerful across all attributes. S-Rank is within reach.';
  if (streakCount >= 14)
    return `${streakCount}-day streak active. Consistency like this rewires your baseline.`;
  if (questsDone === questsTotal && questsTotal > 0)
    return 'Board cleared. Rest tonight — rise again tomorrow.';
  if (weakest.val < 40)
    return `${weakest.key} is your weak link. Target it specifically this week.`;
  if (stats.DISCIPLINE < 40)
    return 'Discipline drives everything else. Lock in the daily challenges first.';
  return 'Every rep you skip is a gap in your armor. Fill it.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HunterCard() {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();

  const [stats,        setStats]        = useState<HunterStats | null>(null);
  const [quests,       setQuests]       = useState<DailyQuest[]>([]);
  const [challenges,   setChallenges]   = useState<DailyChallengesDoc | null>(null);
  const [penalty,      setPenalty]      = useState<PenaltyQuest | null>(null);
  const [questsReady,  setQuestsReady]  = useState(false);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchStats()           .then(setStats)      .catch(() => {});
    fetchTodayChallenges() .then(setChallenges) .catch(() => {});
    fetchActivePenalty()   .then((r) => setPenalty(r.penalty)).catch(() => {});
    fetchTodayQuests()
      .then((data) => { setQuests(data); setQuestsReady(true); })
      .catch(() => { setQuestsReady(true); });
  }, [firebaseUser]);

  if (!userProfile || !firebaseUser) return null;

  const { xp, level, streakCount, rank, activeTitle, titles } = userProfile;
  const { displayName, photoURL, email } = firebaseUser;

  const name         = displayName ?? email?.split('@')[0] ?? 'Hunter';
  const displayTitle = pendingTitle ?? activeTitle;
  const xpNeeded     = xpRequiredForLevel(level);
  const xpPct        = Math.min(100, xpNeeded > 0 ? (xp / xpNeeded) * 100 : 0);

  // ── Rank progress ─────────────────────────────────────────────────────────
  const rankScore = level * 2 + Math.min(streakCount, 60);
  const rankInfo  = RANK_CHAIN.find((r) => r.rank === rank) ?? RANK_CHAIN[0];
  const rankPct   =
    rankInfo.nextMin == null
      ? 100
      : Math.min(100, ((rankScore - rankInfo.min) / (rankInfo.nextMin - rankInfo.min)) * 100);
  const ptsToNext = rankInfo.nextMin != null ? Math.max(0, rankInfo.nextMin - rankScore) : 0;

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
  const insight = generateInsight(stats, streakCount, questsDone, questsTotal);

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
              <span className="text-[10px] text-green-300">{recentTitle}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="text-lg font-bold text-white leading-tight mt-3">{name}</h1>

        <div className="flex items-center gap-2 mt-2">
          <RankBadge rank={rank ?? 'E'} size="md" />
          {displayTitle && (
            <span className="text-xs text-muted italic">"{displayTitle}"</span>
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

        {/* Rank progress bar */}
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
                    rankInfo.nextMin == null
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />
            </div>
            {rankInfo.next && (
              <span className={`text-[11px] font-bold ${RANK_STYLES[rankInfo.next]}`}>
                {rankInfo.next}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted mt-1 text-right">
            {rankInfo.nextMin == null
              ? 'Max rank achieved'
              : `${ptsToNext} pts to ${rankInfo.next}-Rank · Score ${rankScore}`}
          </p>
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
        <p className="text-[10px] text-muted uppercase tracking-widest mb-2">Insight</p>
        <p className="text-xs text-accent-light/90 leading-relaxed italic">
          "{insight}"
        </p>
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
            <p className="text-[10px] text-muted uppercase tracking-widest mb-3">Titles</p>
            <div className="flex flex-wrap gap-1.5">
              {(titles ?? []).map((title) => {
                const isActive = title === displayTitle;
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
                    {title}
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
