'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuests } from '@/context/QuestContext';
import {
  fetchStravaStatus,
  fetchStravaAuthUrl,
  syncStrava,
  StravaSyncResponse,
} from '@/lib/api';

export default function StravaSyncButton() {
  const { refresh } = useQuests();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [syncing, setSyncing]     = useState(false);
  const [result, setResult]       = useState<StravaSyncResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetchStravaStatus()
      .then((r) => setConnected(r.connected))
      .catch(() => setConnected(false));

    // Handle redirect back from Strava OAuth
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

  async function handleConnect() {
    setError(null);
    try {
      const { url } = await fetchStravaAuthUrl();
      window.location.href = url;
    } catch {
      setError('Could not initiate Strava connection.');
    }
  }

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const data = await syncStrava();
      setResult(data);
      if (data.processed > 0) await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  if (connected === null) return null;

  return (
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
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/30 text-[#FC4C02] text-sm font-semibold hover:bg-[#FC4C02]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <StravaIcon />
          {syncing ? 'Syncing...' : 'Sync with Strava'}
        </button>
      )}

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
                  {r.belowTarget && ` — Target: ${r.target} km`}
                </span>
                <div className="flex gap-1.5 text-xs font-bold">
                  {r.xp && (
                    <span className="text-accent-light">+50 XP</span>
                  )}
                  {r.bonusXp && (
                    <span className="text-yellow-400">+{r.bonusXp} bonus</span>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {result && result.processed === 0 && (
          <motion.p
            key="no-runs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-center text-xs text-muted"
          >
            No new runs found.
          </motion.p>
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
  );
}

function StravaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
