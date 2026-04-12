import { auth } from './firebase';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Users
export function fetchUserProfile(email?: string) {
  const qs = email ? `?email=${encodeURIComponent(email)}` : '';
  return apiFetch<UserProfile>(`/api/users/me${qs}`);
}

// Quests
export function fetchTodayQuests() {
  return apiFetch<DailyQuest[]>('/api/quests/today');
}

export function generateDailyQuests() {
  return apiFetch<{ generated: boolean; message: string }>('/api/quests/generate', {
    method: 'POST',
  });
}

export function updateQuestProgress(questId: string, currentValue: number) {
  return apiFetch<QuestUpdateResult>(`/api/quests/${questId}`, {
    method: 'PATCH',
    body: JSON.stringify({ currentValue }),
  });
}

// Types
export interface UserProfile {
  id: string;
  email: string;
  xp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
}

export interface DailyQuest {
  id: string;
  userId: string;
  questId: string;
  date: string;
  currentValue: number;
  completed: boolean;
  title: string;
  type: 'fitness' | 'habit';
  targetValue: number;
  xpReward: number;
  isCustom: boolean;
}

export interface QuestUpdateResult {
  completed: boolean;
  currentValue: number;
  alreadyCompleted?: boolean;
  xp?: { xp: number; level: number };
  streak?: { streakCount: number };
}
