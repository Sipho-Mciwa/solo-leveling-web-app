'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import ProgressBar from './ProgressBar';
import RankBadge from './RankBadge';

const NAV_TABS = [
  { label: 'Today', href: '/' },
  { label: 'History', href: '/dashboard' },
  { label: 'Analytics', href: '/analytics' },
];

export default function Header() {
  const { userProfile, logout } = useAuth();
  const pathname = usePathname();

  if (!userProfile) return null;

  const { xp, level, streakCount, rank, activeTitle } = userProfile;
  const xpNeeded = xpRequiredForLevel(level);

  return (
    <header className="border-b border-border">
      {/* Stats row */}
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-sm font-semibold tracking-widest text-accent-light uppercase">
            Solo Leveling
          </h1>
          {activeTitle && (
            <p className="text-[10px] text-muted italic mt-0.5">"{activeTitle}"</p>
          )}
        </div>

        <div className="flex-1 max-w-xs">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span className="flex items-center gap-1.5">
              Level {level}
              {rank && <RankBadge rank={rank} size="sm" />}
            </span>
            <span>{xp} / {xpNeeded} XP</span>
          </div>
          <ProgressBar current={xp} target={xpNeeded} color="bg-accent" />
        </div>

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

      {/* Nav tabs */}
      <div className="max-w-4xl mx-auto px-6 flex gap-1">
        {NAV_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              pathname === tab.href
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
