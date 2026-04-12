'use client';

import { useChallenges } from '@/context/ChallengeContext';
import { useAuth } from '@/context/AuthContext';
import { DailyChallenge } from '@/lib/api';

export default function ChallengeSection() {
  const { challengeDoc, loading } = useChallenges();

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
  const allComplete = completedCount === challenges.length;
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

      <div className="space-y-2">
        {challenges.map((c) => (
          <ChallengeItem key={c.key} challenge={c} />
        ))}
      </div>

      {allComplete && (
        <p className="mt-3 text-center text-xs text-yellow-400/80">
          All challenges complete — discipline maintained.
        </p>
      )}
    </section>
  );
}

function ChallengeItem({ challenge }: { challenge: DailyChallenge }) {
  const { complete } = useChallenges();
  const { refreshProfile } = useAuth();

  async function handleClick() {
    if (challenge.completed) return;
    await complete(challenge.key);
    await refreshProfile();
  }

  return (
    <button
      onClick={handleClick}
      disabled={challenge.completed}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        challenge.completed
          ? 'bg-surface/30 border-border/30 cursor-default'
          : 'bg-surface border-border hover:border-yellow-400/40 hover:bg-surface/80 cursor-pointer'
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          challenge.completed
            ? 'border-yellow-400 bg-yellow-400'
            : 'border-border'
        }`}
      >
        {challenge.completed && (
          <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

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
    </button>
  );
}
