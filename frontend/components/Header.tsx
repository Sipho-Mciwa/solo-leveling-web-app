'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, User, History, BarChart3, Trophy, Swords } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWeekendBoss } from '@/context/WeekendBossContext';
import { xpRequiredForLevel } from '@/lib/xpUtils';
import { resolveAchievementName } from '@/utils/achievementMap';
import ProgressBar from './ProgressBar';
import RankBadge from './RankBadge';
import ProfileAvatar from './ProfileAvatar';

const NAV_TABS = [
  { label: 'Dashboard', href: '/',          icon: LayoutDashboard },
  { label: 'Profile',   href: '/profile',   icon: User },
  { label: 'History',   href: '/history',   icon: History },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Titles',    href: '/titles',    icon: Trophy },
];

const BOSS_TAB = { label: 'Boss', href: '/boss', icon: Swords };

export default function Header() {
  const { userProfile, firebaseUser, logout } = useAuth();
  const { boss } = useWeekendBoss();
  const pathname = usePathname();

  if (!userProfile) return null;

  const bossActive = boss?.status === 'active' || boss?.status === 'completed';
  const navTabs = bossActive ? [BOSS_TAB, ...NAV_TABS] : NAV_TABS;

  const { xp, level, rank, activeTitle, titles } = userProfile;
  const { displayName, photoURL, email } = firebaseUser ?? {};

  const name             = displayName ?? email?.split('@')[0] ?? 'Hunter';
  const displayTitleName = activeTitle ? resolveAchievementName(activeTitle) : null;
  const xpNeeded = xpRequiredForLevel(level);

  const recentTitle     = (titles?.length ?? 0) > 1 ? titles[titles.length - 1] : null;
  const showAchievement = recentTitle && recentTitle !== 'E Rank Hunter';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      {/* Stats row
          Mobile:  row 1 = [Identity | Rank+SignOut]
                   row 2 = [Level+XP bar — full width]
          Desktop: single row = [Identity] [XP bar] [Rank+SignOut]
      */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2">
        {/* Identity — order 1 on mobile, order 1 on desktop */}
        <div className="order-1 flex items-center gap-2.5 min-w-0">
          <ProfileAvatar photoURL={photoURL} displayName={displayName} email={email} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white truncate">{name}</span>
              {displayTitleName && (
                <span className="text-xs text-muted italic truncate">&quot;{displayTitleName}&quot;</span>
              )}
            </div>
            <AnimatePresence>
              {showAchievement && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
                  className="inline-flex items-center gap-1 bg-success/10 border border-success/20 rounded-full px-2 py-0.5 mt-0.5"
                >
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-success">
                    Achievement
                  </span>
                  <span className="text-[9px] text-success">{resolveAchievementName(recentTitle ?? '')}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* XP bar — order 3 (full-width second row) on mobile, order 2 (middle) on desktop */}
        <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:max-w-xs">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Level {level}</span>
            <span>{xp} / {xpNeeded} XP</span>
          </div>
          <ProgressBar current={xp} target={xpNeeded} color="bg-accent" />
        </div>

        {/* Rank + Sign out — order 2 (pushed right) on mobile, order 3 on desktop */}
        <div className="order-2 ml-auto sm:order-3 sm:ml-0 flex items-center gap-3">
          {rank && <RankBadge rank={rank} size="md" />}
          <button
            onClick={logout}
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isBossTab = tab.href === '/boss';
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex shrink-0 items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                pathname === tab.href
                  ? 'border-accent text-white'
                  : 'border-transparent text-muted hover:text-white'
              }`}
            >
              <Icon size={20} className={isBossTab ? 'text-red-500' : undefined} />
              <span className="hidden xs:inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
