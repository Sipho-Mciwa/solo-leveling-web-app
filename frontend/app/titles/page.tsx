'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  fetchTitleProgress,
  setActiveTitle,
  TitleDefinition,
} from '@/lib/api';
import Header from '@/components/Header';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  consistency: 'Consistency',
  running:     'Running',
  discipline:  'Discipline',
  intellect:   'Intellect',
  recovery:    'Recovery',
  boss:        'Boss Quests',
  rare:        'Rare',
};

const TIER_COLORS: Record<string | number, string> = {
  1:    'text-gray-400 border-gray-600',
  2:    'text-blue-400 border-blue-500/40',
  3:    'text-purple-400 border-purple-500/40',
  4:    'text-yellow-400 border-yellow-500/40',
  rare: 'text-red-400 border-red-500/40',
};

const TIER_LABELS: Record<string | number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', rare: '★',
};

// ─── TitleCard ────────────────────────────────────────────────────────────────

function TitleCard({
  title,
  onEquip,
  pending,
}: {
  title: TitleDefinition;
  onEquip: (id: string) => void;
  pending: boolean;
}) {
  const tierClass  = TIER_COLORS[title.tier] ?? TIER_COLORS[1];
  const tierLabel  = TIER_LABELS[title.tier] ?? '';
  const pct        = title.progress
    ? Math.round((title.progress.current / title.progress.target) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-colors ${
        title.active
          ? 'bg-accent/10 border-accent/40'
          : title.unlocked
          ? 'bg-surface border-border hover:border-subtle'
          : 'bg-surface/40 border-border/50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold border rounded px-1 py-0.5 ${tierClass}`}>
              {tierLabel}
            </span>
            <p className={`text-sm font-semibold truncate ${title.unlocked ? 'text-white' : 'text-muted'}`}>
              {title.name}
            </p>
            {title.active && (
              <span className="text-[10px] font-semibold text-accent-light bg-accent/15 rounded-full px-2 py-0.5 shrink-0">
                Equipped
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted leading-snug">{title.description}</p>
        </div>

        {title.unlocked && !title.active && (
          <button
            onClick={() => onEquip(title.id)}
            disabled={pending}
            className="shrink-0 text-[11px] font-medium text-accent-light border border-accent/30 rounded-full px-3 py-1.5 hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            Equip
          </button>
        )}
      </div>

      {/* Progress bar for locked titles */}
      {!title.unlocked && title.progress && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>Progress</span>
            <span className="tabular-nums">{title.progress.current} / {title.progress.target}</span>
          </div>
          <div className="h-1 rounded-full bg-subtle overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent/50"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TitlesPage() {
  const { firebaseUser, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [titles,      setTitles]      = useState<TitleDefinition[]>([]);
  const [categories,  setCategories]  = useState<string[]>([]);
  const [activeTab,   setActiveTab]   = useState<string>('consistency');
  const [fetching,    setFetching]    = useState(true);
  const [pending,     setPending]     = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchTitleProgress()
      .then((data) => {
        setTitles(data.titles);
        setCategories(data.categories);
        if (data.categories.length) setActiveTab(data.categories[0]);
      })
      .catch(() => setError('Failed to load titles'))
      .finally(() => setFetching(false));
  }, [firebaseUser]);

  async function handleEquip(id: string) {
    if (pending) return;
    setPending(id);
    try {
      await setActiveTitle(id);
      await refreshProfile();
      setTitles((prev) => prev.map((t) => ({ ...t, active: t.id === id })));
    } catch {
      // silently ignore
    } finally {
      setPending(null);
    }
  }

  if (loading || !firebaseUser) return null;

  const tabTitles = titles.filter((t) => t.category === activeTab);
  const unlockedCount = titles.filter((t) => t.unlocked).length;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-xl font-bold text-white">Titles</h1>
          <p className="text-sm text-muted mt-1">
            {fetching ? '…' : `${unlockedCount} / ${titles.length} unlocked`}
          </p>
        </motion.div>

        {error && (
          <p className="text-sm text-red-400 text-center py-8">{error}</p>
        )}

        {/* Category tabs */}
        {!fetching && !error && (
          <>
            <div className="flex gap-1.5 flex-wrap mb-6">
              {categories.map((cat) => {
                const catTitles   = titles.filter((t) => t.category === cat);
                const catUnlocked = catTitles.filter((t) => t.unlocked).length;
                const isActive    = cat === activeTab;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`text-[11px] font-medium rounded-full px-3 py-1.5 border transition-colors ${
                      isActive
                        ? 'bg-accent/20 border-accent/50 text-accent-light'
                        : 'bg-transparent border-border text-muted hover:border-subtle hover:text-white'
                    }`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                    <span className="ml-1.5 opacity-60">
                      {catUnlocked}/{catTitles.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Title cards */}
            <div className="space-y-3">
              {tabTitles.map((title) => (
                <TitleCard
                  key={title.id}
                  title={title}
                  onEquip={handleEquip}
                  pending={pending === title.id}
                />
              ))}
            </div>
          </>
        )}

        {fetching && !error && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-surface/40 border border-border/50 animate-pulse" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
