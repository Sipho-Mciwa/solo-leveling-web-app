'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuests } from '@/context/QuestContext';
import { useAuth } from '@/context/AuthContext';
import {
  fetchStravaStatus,
  fetchStravaAuthUrl,
  syncStrava,
  StravaSyncResponse,
} from '@/lib/api';
import XPToast from './XPToast';
import LevelUpModal from './LevelUpModal';

const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;

export default function StravaSyncButton() {
  const { refresh }         = useQuests();
  const { refreshProfile }  = useAuth();

  const [connected, setConnected]       = useState<boolean | null>(null);
  const [syncing, setSyncing]           = useState(false);
  const [autoSyncing, setAutoSyncing]   = useState(false);
  const [result, setResult]             = useState<StravaSyncResponse | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // XP + level-up animation state
  const [xpToast, setXpToast]         = useState<number | null>(null);
  const [levelUp, setLevelUp]         = useState<{ newLevel: number; previousLevel: number } | null>(null);

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  // ─── Initial status + OAuth callback ───────────────────────────────────────

  useEffect(() => {
    fetchStravaStatus()
      .then((r) => setConnected(r.connected))
      .catch(() => setConnected(false));

    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get('strava');
    if (stravaParam === 'connected') {
      setConnected(true);
      window.history.replaceState({}, '', '/dashboard');
    } else if (stravaParam === 'error') {
      setError('Failed to connect Strava. Please try again.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // ─── Process sync results ──────────────────────────────────────────────────

  function handleSyncResult(data: StravaSyncResponse) {
    if (data.processed === 0) return;

    setResult(data);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setResult(null), 8000);

    // Aggregate XP across all processed runs
    const totalXp = data.results.reduce((sum, r) => {
      return sum + (r.xp?.xpGained ?? 0) + (r.bonusXp ?? 0);
    }, 0);

    if (totalXp > 0) setXpToast(totalXp);

    // Show level-up modal if any run caused a level-up
    const levelUpResult = data.results.find((r) => r.xp?.leveledUp);
    if (levelUpResult?.xp?.leveledUp) {
      setLevelUp({
        newLevel:      levelUpResult.xp.level,
        previousLevel: levelUpResult.xp.previousLevel,
      });
    }
  }

  // ─── Core sync ─────────────────────────────────────────────────────────────

  const runSync = useCallback(async (isAuto = false) => {
    if (isAuto) setAutoSyncing(true); else setSyncing(true);
    if (!isAuto) { setResult(null); setError(null); }

    try {
      const data = await syncStrava();
      handleSyncResult(data);
      if (data.processed > 0) {
        await Promise.all([refresh(), refreshProfile()]);
      }
    } catch (err: unknown) {
      if (!isAuto) setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      if (isAuto) setAutoSyncing(false); else setSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshProfile]);

  // ─── 10-min auto-sync interval ─────────────────────────────────────────────

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => runSync(true), AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [connected, runSync]);

  // ─── OAuth connect ─────────────────────────────────────────────────────────

  async function handleConnect() {
    setError(null);
    try {
      const { url } = await fetchStravaAuthUrl();
      window.location.href = url;
    } catch {
      setError('Could not initiate Strava connection.');
    }
  }

  if (connected === null) return null;

  return (
    <>
      {/* XP float toast */}
      <AnimatePresence>
        {xpToast !== null && (
          <XPToast key="xp-toast" xp={xpToast} onDone={() => setXpToast(null)} />
        )}
      </AnimatePresence>

      {/* Level-up modal */}
      <AnimatePresence>
        {levelUp && (
          <LevelUpModal
            key="level-up"
            newLevel={levelUp.newLevel}
            previousLevel={levelUp.previousLevel}
            onDismiss={() => setLevelUp(null)}
          />
        )}
      </AnimatePresence>

      <div className="mt-4">
        {!connected ? (
          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/30 text-[#FC4C02] text-sm font-semibold hover:bg-[#FC4C02]/20 transition-colors"
          >
            <StravaIcon />
            Connect Strava
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => runSync(false)}
              disabled={syncing || autoSyncing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/30 text-[#FC4C02] text-sm font-semibold hover:bg-[#FC4C02]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <StravaIcon />
              {syncing ? 'Syncing...' : 'Sync with Strava'}
            </button>

            {/* Auto-sync indicator */}
            <AnimatePresence>
              {autoSyncing && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 text-[10px] text-[#FC4C02]/60 whitespace-nowrap"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FC4C02]/60 animate-pulse" />
                  syncing
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && result.processed > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 space-y-1.5"
            >
              {result.results.map((r) => (
                <div
                  key={r.activityId}
                  className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm"
                >
                  <span className="text-green-400">
                    Run detected: {r.distanceKm.toFixed(1)} km
                    {r.completed && ' — Quest Completed'}
                    {r.belowTarget && ` — below ${r.target} km target`}
                  </span>
                  <div className="flex gap-1.5 text-xs font-bold shrink-0 ml-2">
                    {r.xp?.xpGained && (
                      <span className="text-accent-light">+{r.xp.xpGained} XP</span>
                    )}
                    {r.bonusXp && (
                      <span className="text-yellow-400">+{r.bonusXp} bonus</span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-center text-xs text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function StravaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
