'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  fetchTodayChallenges,
  completeChallenge,
  DailyChallengesDoc,
} from '@/lib/api';
import { useAuth } from './AuthContext';

interface ChallengeContextValue {
  challengeDoc: DailyChallengesDoc | null;
  loading: boolean;
  error: string | null;
  complete: (key: string) => Promise<{ bonusAwarded: boolean; allComplete: boolean } | void>;
  refresh: () => Promise<void>;
}

const ChallengeContext = createContext<ChallengeContextValue>({
  challengeDoc: null,
  loading: true,
  error: null,
  complete: async () => {},
  refresh: async () => {},
});

export function ChallengeProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [challengeDoc, setChallengeDoc] = useState<DailyChallengesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodayChallenges();
      setChallengeDoc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function complete(key: string) {
    if (!challengeDoc) return;
    const result = await completeChallenge(challengeDoc.id, key);
    if (result.alreadyCompleted) return;

    // Optimistically update local state
    setChallengeDoc((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        challenges: prev.challenges.map((c) =>
          c.key === key ? { ...c, completed: true } : c
        ),
        bonusAwarded: result.bonusAwarded ? true : prev.bonusAwarded,
      };
    });

    return { bonusAwarded: result.bonusAwarded, allComplete: result.allComplete };
  }

  return (
    <ChallengeContext.Provider value={{ challengeDoc, loading, error, complete, refresh }}>
      {children}
    </ChallengeContext.Provider>
  );
}

export const useChallenges = () => useContext(ChallengeContext);
