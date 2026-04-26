'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChallenges } from '@/context/ChallengeContext';
import { useAuth } from '@/context/AuthContext';
import { DailyChallenge, AISuggestion, fetchAIChallenges } from '@/lib/api';

// ─── Stagger variants ─────────────────────────────────────────────────────────

const listVariants = {
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChallengeSection() {
  const { challengeDoc, loading } = useChallenges();
  const { firebaseUser } = useAuth();
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchAIChallenges()
      .then((r) => setAiSuggestions(r.challenges))
      .catch(() => {});
  }, [firebaseUser]);

  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="h-5 w-36 bg-surface rounded animate-pulse" />
            <div className="h-3 w-24 bg-surface rounded mt-1.5 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-13 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!challengeDoc) return null;

  const { challenges, bonusAwarded } = challengeDoc;
  const completedCount = challenges.filter((c) => c.completed).length;
  const allComplete    = completedCount === challenges.length;
  const earnedXp =
    challenges.filter((c) => c.completed).reduce((sum, c) => sum + c.xpReward, 0) +
    (bonusAwarded ? 100 : 0);

  return (
    <section className="mb-8">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Daily Challenges</h2>
          <p className="text-muted text-xs mt-0.5">
            {completedCount}/{challenges.length} completed
          </p>
        </div>
        <div className="text-right">
          <p className="text-yellow-400 text-sm font-semibold">{earnedXp} XP</p>
          {allComplete && bonusAwarded && (
            <p className="text-yellow-400/70 text-[10px] mt-0.5">+100 bonus earned</p>
          )}
          {allComplete && !bonusAwarded && (
            <p className="text-yellow-400/70 text-[10px] mt-0.5">+100 bonus pending</p>
          )}
        </div>
      </div>

      {/* Staggered list */}
      <motion.div
        className="space-y-2"
        initial="hidden"
        animate="visible"
        variants={listVariants}
      >
        {challenges.map((c) => (
          <motion.div key={c.key} variants={itemVariants}>
            <ChallengeItem challenge={c} />
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence>
        {allComplete && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-3 text-center text-xs text-yellow-400/80"
          >
            All challenges complete — discipline maintained.
          </motion.p>
        )}
      </AnimatePresence>

      {/* AI Suggestions */}
      <AnimatePresence>
        {aiSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] text-muted uppercase tracking-widest">Coach Suggests</p>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-accent-light/60 bg-accent/10 border border-accent/20 rounded-full px-1.5 py-0.5">
                AI
              </span>
            </div>
            <div className="space-y-2">
              {aiSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border border-accent/20 bg-accent/5"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] text-accent-light/60">✦</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{s.title}</p>
                    <p className="text-[11px] text-muted mt-0.5 leading-snug">{s.description}</p>
                  </div>
                  <span className="text-xs font-medium text-accent-light/70 shrink-0">
                    +{s.xpReward} XP
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Challenge item ───────────────────────────────────────────────────────────

function ChallengeItem({ challenge }: { challenge: DailyChallenge }) {
  const { complete }     = useChallenges();
  const { refreshProfile } = useAuth();

  async function handleClick() {
    if (challenge.completed) return;
    await complete(challenge.key);
    await refreshProfile();
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={challenge.completed}
      // Tap shrink feedback
      whileTap={!challenge.completed ? { scale: 0.97 } : {}}
      transition={{ duration: 0.1 }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left min-h-[48px] ${
        challenge.completed
          ? 'bg-surface/30 border-border/30 cursor-default'
          : 'bg-surface border-border hover:border-yellow-400/40 hover:bg-surface/80 cursor-pointer'
      }`}
    >
      {/* Checkbox circle — bounces on completion */}
      <motion.div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          challenge.completed ? 'border-yellow-400 bg-yellow-400' : 'border-border'
        }`}
        animate={challenge.completed ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <AnimatePresence>
          {challenge.completed && (
            <motion.svg
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="w-3 h-3 text-black"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Title */}
      <span
        className={`flex-1 text-sm transition-colors ${
          challenge.completed ? 'text-muted line-through' : 'text-white'
        }`}
      >
        {challenge.title}
      </span>

      {/* XP badge */}
      <span
        className={`text-xs font-medium transition-colors ${
          challenge.completed ? 'text-muted' : 'text-yellow-400'
        }`}
      >
        +{challenge.xpReward} XP
      </span>
    </motion.button>
  );
}
