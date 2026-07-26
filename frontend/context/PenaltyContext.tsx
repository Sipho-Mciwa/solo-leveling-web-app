'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchActivePenalty, PenaltyQuest } from '@/lib/api';
import { useAuth } from './AuthContext';

interface PenaltyContextValue {
  penalty: PenaltyQuest | null;
  loading: boolean;
  setPenalty: (penalty: PenaltyQuest) => void;
  refresh: () => Promise<void>;
}

const PenaltyContext = createContext<PenaltyContextValue>({
  penalty: null,
  loading: true,
  setPenalty: () => {},
  refresh: async () => {},
});

export function PenaltyProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [penalty, setPenalty] = useState<PenaltyQuest | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const r = await fetchActivePenalty();
      setPenalty(r.penalty);
    } catch {
      setPenalty(null);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PenaltyContext.Provider value={{ penalty, loading, setPenalty, refresh }}>
      {children}
    </PenaltyContext.Provider>
  );
}

export const usePenalty = () => useContext(PenaltyContext);
