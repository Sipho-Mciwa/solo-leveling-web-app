'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchWeekendBoss, generateWeekendBoss, WeekendBoss } from '@/lib/api';
import { useAuth } from './AuthContext';

interface WeekendBossContextValue {
  boss: WeekendBoss | null;
  loading: boolean;
  setBoss: (boss: WeekendBoss) => void;
  refresh: () => Promise<void>;
}

const WeekendBossContext = createContext<WeekendBossContextValue>({
  boss: null,
  loading: true,
  setBoss: () => {},
  refresh: async () => {},
});

export function WeekendBossProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [boss, setBoss] = useState<WeekendBoss | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const day = new Date().getDay();
      const isWeekend = day === 0 || day === 6;
      if (isWeekend) {
        try {
          const r = await generateWeekendBoss();
          setBoss(r.boss ?? null);
        } catch {
          const r = await fetchWeekendBoss();
          setBoss(r.boss);
        }
      } else {
        const r = await fetchWeekendBoss();
        setBoss(r.boss);
      }
    } catch {
      setBoss(null);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <WeekendBossContext.Provider value={{ boss, loading, setBoss, refresh }}>
      {children}
    </WeekendBossContext.Provider>
  );
}

export const useWeekendBoss = () => useContext(WeekendBossContext);
