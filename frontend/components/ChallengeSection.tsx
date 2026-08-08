'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useChallenges } from '@/context/ChallengeContext';
import { useAuth } from '@/context/AuthContext';
import { DailyChallenge, AISuggestion, fetchAIChallenges, acceptAISuggestion, generateSubtasks, toggleSubtask } from '@/lib/api';

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

  function markAccepted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'accepted' } : s))
    );
  }

  function markSubtasks(index: number, subtasks: AISuggestion['subtasks']) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, subtasks } : s))
    );
  }

  function markCompleted(index: number) {
    setAiSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'completed' } : s))
    );
  }

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
          <p className="text-warning text-sm font-semibold">{earnedXp} XP</p>
          {allComplete && bonusAwarded && (
            <p className="text-warning/70 text-xs mt-0.5">+100 bonus earned</p>
          )}
          {allComplete && !bonusAwarded && (
            <p className="text-warning/70 text-xs mt-0.5">+100 bonus pending</p>
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
            className="mt-3 text-center text-xs text-warning/80"
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
              <p className="text-xs text-muted uppercase tracking-widest">Coach Suggests</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-light/60 bg-accent/10 border border-accent/20 rounded-full px-1.5 py-0.5">
                AI
              </span>
            </div>
            <div className="space-y-2">
              {aiSuggestions.map((s, i) => {
                const selectedIndex = aiSuggestions.findIndex((x) => x.status !== 'suggested');
                return (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    index={i}
                    isLocked={selectedIndex !== -1 && selectedIndex !== i}
                    onAccepted={markAccepted}
                    onSubtasksGenerated={markSubtasks}
                    onSubtaskToggled={markSubtasks}
                    onCompleted={markCompleted}
                  />
                );
              })}
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
          : 'bg-surface border-border hover:border-warning/40 hover:bg-surface/80 cursor-pointer'
      }`}
    >
      {/* Checkbox circle — bounces on completion */}
      <motion.div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          challenge.completed ? 'border-warning bg-warning' : 'border-border'
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
          challenge.completed ? 'text-muted' : 'text-warning'
        }`}
      >
        +{challenge.xpReward} XP
      </span>
    </motion.button>
  );
}

// ─── AI suggestion card ─────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  isLocked,
  onAccepted,
  onSubtasksGenerated,
  onSubtaskToggled,
  onCompleted,
}: {
  suggestion: AISuggestion;
  index: number;
  isLocked: boolean;
  onAccepted: (index: number) => void;
  onSubtasksGenerated: (index: number, subtasks: AISuggestion['subtasks']) => void;
  onSubtaskToggled: (index: number, subtasks: AISuggestion['subtasks']) => void;
  onCompleted: (index: number) => void;
}) {
  const { refreshProfile } = useAuth();
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false);
  const [subtaskError, setSubtaskError] = useState(false);
  const isAccepted = suggestion.status === 'accepted';
  const isCompleted = suggestion.status === 'completed';
  const hasSubtasks = Boolean(suggestion.subtasks?.length);

  async function handleAccept() {
    if (suggestion.status !== 'suggested' || isLocked) return;
    const res = await acceptAISuggestion(index);
    if (res.status === 'completed') {
      onCompleted(index);
      return;
    }
    onAccepted(index);
    setGeneratingSubtasks(true);
    try {
      const { subtasks } = await generateSubtasks(index);
      onSubtasksGenerated(index, subtasks);
      setSubtaskError(false);
    } catch {
      setSubtaskError(true);
    } finally {
      setGeneratingSubtasks(false);
    }
  }

  async function handleRetryGenerateSubtasks() {
    setSubtaskError(false);
    setGeneratingSubtasks(true);
    try {
      const { subtasks } = await generateSubtasks(index);
      onSubtasksGenerated(index, subtasks);
    } catch {
      setSubtaskError(true);
    } finally {
      setGeneratingSubtasks(false);
    }
  }

  async function handleToggleSubtask(subIndex: number) {
    const res = await toggleSubtask(index, subIndex);
    onSubtaskToggled(index, res.subtasks);
    if (res.completed) {
      onCompleted(index);
      await refreshProfile();
    }
  }

  const iconWrapClasses = `w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
    isCompleted
      ? 'border-accent bg-accent'
      : isAccepted
      ? 'border-accent-light bg-accent/30'
      : 'border-accent/40'
  }`;

  const body = (
    <>
      <div className={iconWrapClasses}>
        {isCompleted ? (
          <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <Sparkles size={14} className={isAccepted ? 'text-accent-light' : 'text-accent-light/60'} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isCompleted ? 'text-muted line-through' : 'text-white'}`}>
          {suggestion.title}
        </p>
        <p className="text-[11px] text-muted mt-0.5 leading-snug">{suggestion.description}</p>

        {isAccepted && generatingSubtasks && (
          <div className="mt-2 space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-accent/10 rounded animate-pulse" />
            ))}
          </div>
        )}

        {isAccepted && !generatingSubtasks && subtaskError && !hasSubtasks && (
          <button
            type="button"
            onClick={handleRetryGenerateSubtasks}
            className="mt-2 text-[11px] text-accent-light/80 underline"
          >
            Checklist failed to generate — tap to retry
          </button>
        )}

        {isAccepted && hasSubtasks && (
          <ul className="mt-2 space-y-1.5">
            {suggestion.subtasks!.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleToggleSubtask(i)}
                  disabled={s.completed}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                      s.completed ? 'border-accent bg-accent' : 'border-accent/40'
                    }`}
                  >
                    {s.completed && (
                      <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={`text-[11px] ${s.completed ? 'text-muted line-through' : 'text-white/80'}`}>
                    {s.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className={`text-xs font-medium shrink-0 ${isCompleted ? 'text-muted' : 'text-accent-light/70'}`}>
        +{suggestion.xpReward} XP
      </span>
    </>
  );

  // A locked-but-still-'suggested' card (the sibling of whichever one got
  // accepted) must NOT be a <button> at all, even a disabled one — a
  // disabled button still exposes role="button" in the accessibility tree,
  // which would make it indistinguishable from an interactive card to
  // anything querying by role. Only a truly selectable card is a <button>;
  // every other state (locked, accepted, completed) is an inert <div>.
  if (suggestion.status === 'suggested' && !isLocked) {
    return (
      <button
        onClick={handleAccept}
        className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all border-accent/20 bg-accent/5 hover:bg-accent/10 cursor-pointer"
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        isCompleted || isLocked ? 'border-border/30 bg-surface/30' : 'border-accent/40 bg-accent/10'
      } ${isLocked ? 'opacity-50' : ''}`}
    >
      {body}
    </div>
  );
}
