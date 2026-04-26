'use client';

import { useState } from 'react';
import { setActiveTitle } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { resolveAchievementName } from '@/utils/achievementMap';
import RankBadge from './RankBadge';

export default function RewardsPanel() {
  const { userProfile, refreshProfile } = useAuth();
  const [setting, setSetting] = useState<string | null>(null);

  if (!userProfile) return null;

  const { rank, titles, activeTitle } = userProfile;

  async function handleSetTitle(title: string) {
    if (title === activeTitle) return;
    setSetting(title);
    try {
      await setActiveTitle(title);
      await refreshProfile();
    } catch (err) {
      console.error('Failed to set title:', err);
    } finally {
      setSetting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Rank & Titles</p>
          <div className="flex items-center gap-2 mt-1">
            <RankBadge rank={rank ?? 'E'} size="lg" />
            {activeTitle && (
              <span className="text-xs text-muted italic">"{activeTitle}"</span>
            )}
          </div>
        </div>
      </div>

      {titles && titles.length > 0 ? (
        <div className="space-y-2">
          {titles.map((title) => {
            const isActive = title === activeTitle;
            return (
              <button
                key={title}
                onClick={() => handleSetTitle(title)}
                disabled={isActive || setting === title}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  isActive
                    ? 'bg-accent/15 border border-accent/30 text-white cursor-default'
                    : 'bg-subtle border border-border text-muted hover:text-white hover:border-accent/30'
                }`}
              >
                <span>{resolveAchievementName(title)}</span>
                {isActive && (
                  <span className="text-[10px] text-accent-light font-medium uppercase tracking-wide">
                    Active
                  </span>
                )}
                {setting === title && (
                  <span className="text-[10px] text-muted">...</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted">Complete quests to earn titles.</p>
      )}
    </div>
  );
}
