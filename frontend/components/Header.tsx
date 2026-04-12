'use client';

import { useAuth } from '@/context/AuthContext';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import ProgressBar from './ProgressBar';

export default function Header() {
  const { userProfile, logout } = useAuth();

  if (!userProfile) return null;

  const { xp, level, streakCount } = userProfile;
  const xpNeeded = xpRequiredForLevel(level);

  return (
    <header className="border-b border-border px-6 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-6">
        {/* Left: title */}
        <div>
          <h1 className="text-sm font-semibold tracking-widest text-accent-light uppercase">
            Solo Leveling
          </h1>
        </div>

        {/* Center: XP bar */}
        <div className="flex-1 max-w-xs">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Level {level}</span>
            <span>{xp} / {xpNeeded} XP</span>
          </div>
          <ProgressBar current={xp} target={xpNeeded} color="bg-accent" />
        </div>

        {/* Right: streak + logout */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white leading-none">{streakCount}</p>
            <p className="text-xs text-muted">day streak</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
