'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchTodayQuests, updateQuestProgress, DailyQuest } from '@/lib/api';
import { useAuth } from './AuthContext';

interface QuestContextValue {
  quests: DailyQuest[];
  loading: boolean;
  error: string | null;
  updateProgress: (questId: string, value: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const QuestContext = createContext<QuestContextValue>({
  quests: [],
  loading: true,
  error: null,
  updateProgress: async () => {},
  refresh: async () => {},
});

export function QuestProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodayQuests();
      setQuests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function updateProgress(questId: string, value: number) {
    const result = await updateQuestProgress(questId, value);

    // Optimistically update local state
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? { ...q, currentValue: result.currentValue, completed: result.completed }
          : q
      )
    );
  }

  return (
    <QuestContext.Provider value={{ quests, loading, error, updateProgress, refresh }}>
      {children}
    </QuestContext.Provider>
  );
}

export const useQuests = () => useContext(QuestContext);
