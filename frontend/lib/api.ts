import { auth } from './firebase';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

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

export function fetchQuestHistory(month: string) {
  return apiFetch<QuestHistoryResponse>(`/api/quests/history?month=${month}`);
}

// Rank
export function fetchRank() {
  return apiFetch<RankData>('/api/rank');
}
export function setActiveTitle(title: string) {
  return apiFetch<{ activeTitle: string }>('/api/rank/title', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

// Boss
export function generateBossQuest() {
  return apiFetch<{ generated: boolean; boss?: BossQuest }>('/api/boss/generate', { method: 'POST' });
}
export function fetchCurrentBoss() {
  return apiFetch<{ boss: BossQuest | null }>('/api/boss/current');
}
export function updateBossProgress(bossId: string, currentValue: number) {
  return apiFetch<{ completed: boolean; currentValue: number; xp?: { xp: number; level: number } }>(
    `/api/boss/${bossId}`,
    { method: 'PATCH', body: JSON.stringify({ currentValue }) }
  );
}

// Penalty
export function generatePenalty() {
  return apiFetch<{ generated: boolean; penalty?: PenaltyQuest }>('/api/penalty/generate', { method: 'POST' });
}
export function fetchActivePenalty() {
  return apiFetch<{ penalty: PenaltyQuest | null }>('/api/penalty/active');
}
export function updatePenaltyProgress(penaltyId: string, currentValue: number) {
  return apiFetch<{ completed: boolean; currentValue: number }>(
    `/api/penalty/${penaltyId}`,
    { method: 'PATCH', body: JSON.stringify({ currentValue }) }
  );
}

// Challenges
export function fetchTodayChallenges() {
  return apiFetch<DailyChallengesDoc | null>('/api/challenges/today');
}

export function generateDailyChallenges() {
  return apiFetch<{ generated: boolean; message: string }>('/api/challenges/generate', {
    method: 'POST',
  });
}

export function completeChallenge(docId: string, challengeKey: string) {
  return apiFetch<ChallengeCompleteResult>(`/api/challenges/${docId}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ challengeKey }),
  });
}

export function fetchChallengeHistory(month: string) {
  return apiFetch<ChallengeHistoryResponse>(`/api/challenges/history?month=${month}`);
}

// Stats
export function fetchStats() {
  return apiFetch<HunterStats>('/api/stats');
}

// Strava
export function fetchStravaStatus() {
  return apiFetch<{ connected: boolean }>('/api/strava/status');
}

export function fetchStravaAuthUrl() {
  return apiFetch<{ url: string }>('/api/strava/auth');
}

export function syncStrava() {
  return apiFetch<StravaSyncResponse>('/api/strava/sync');
}

export function syncStravaOnLogin() {
  return apiFetch<{ started: boolean }>('/api/strava/sync-on-login', { method: 'POST' });
}

// Analytics
export function fetchAnalyticsOverview() {
  return apiFetch<AnalyticsOverview>('/api/analytics/overview');
}

export function fetchAnalyticsQuests() {
  return apiFetch<{ quests: QuestStat[] }>('/api/analytics/quests');
}

export function fetchAnalyticsHeatmap() {
  return apiFetch<{ data: HeatmapEntry[] }>('/api/analytics/heatmap');
}

// Types
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UserProfile {
  id: string;
  email: string;
  xp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
  rank: Rank;
  titles: string[];
  activeTitle: string | null;
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
  targetValue: number;   // base from quest template
  xpReward: number;
  isCustom: boolean;
  // Difficulty scaling (present on quests generated after the system was added)
  baseTarget?: number;
  currentTarget?: number;
  difficultyMultiplier?: number;
}

export interface QuestUpdateResult {
  completed: boolean;
  currentValue: number;
  alreadyCompleted?: boolean;
  xp?: { xp: number; level: number };
  streak?: { streakCount: number };
  bonusXp?: number;
}

export interface QuestDayEntry {
  completed: boolean;
  currentValue: number;
}

export interface QuestHistoryRow {
  questId: string;
  title: string;
  history: Record<string, QuestDayEntry>; // key = "YYYY-MM-DD"
}

export interface QuestHistoryResponse {
  quests: QuestHistoryRow[];
}

export interface DailyRate {
  date: string;
  rate: number | null; // null = no quests generated that day
}

export interface WeeklyAverage {
  week: string;
  rate: number; // 0–100
}

export interface Insight {
  type: 'success' | 'warning' | 'info';
  title: string;
  text: string;
}

export interface AnalyticsOverview {
  activeDays: number;
  overallCompletionRate: number; // 0–100
  dailyRates: DailyRate[];
  weeklyAverages: WeeklyAverage[];
  insights: Insight[];
}

export interface QuestStat {
  questId: string;
  title: string;
  completionRate: number; // 0–100
  completedDays: number;
  totalDays: number;
}

export interface HeatmapEntry {
  date: string;
  total: number;
  completed: number;
}

// ─── Progression types ────────────────────────────────────────────────────────

export interface RankData {
  rank: Rank;
  titles: string[];
  activeTitle: string | null;
}

export interface BossQuest {
  id: string;
  userId: string;
  weekStart: string;
  title: string;
  description: string;
  questType: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  xpReward: number;
  completed: boolean;
  difficulty: number;
}

export interface DailyChallenge {
  key: string;
  title: string;
  xpReward: number;
  completed: boolean;
}

export interface DailyChallengesDoc {
  id: string;
  userId: string;
  date: string;
  challenges: DailyChallenge[];
  bonusAwarded: boolean;
}

export interface ChallengeHistoryEntry {
  completed: boolean;
}

export interface ChallengeHistoryRow {
  key: string;
  title: string;
  history: Record<string, ChallengeHistoryEntry>; // key = "YYYY-MM-DD"
}

export interface ChallengeHistoryResponse {
  challenges: ChallengeHistoryRow[];
}

export interface ChallengeCompleteResult {
  completed?: boolean;
  alreadyCompleted?: boolean;
  xp?: { xp: number; level: number };
  bonusAwarded: boolean;
  bonusXp?: { xp: number; level: number };
  allComplete: boolean;
}

export interface StatDelta {
  PHY:        number; // last-7 minus prev-7 (positive = improving)
  SPD:        number;
  STAMINA:    number;
  DISCIPLINE: number;
  INTELLECT:  number;
}

export interface HunterStats {
  PHY:        number; // 0–100, full 14-day window
  SPD:        number;
  STAMINA:    number;
  DISCIPLINE: number;
  INTELLECT:  number;
  delta:      StatDelta;
}

export interface StravaSyncActivityResult {
  activityId: string;
  distanceKm: number;
  date: string;
  questFound: boolean;
  alreadyCompleted?: boolean;
  belowTarget?: boolean;
  completed?: boolean;
  xp?: { xp: number; level: number };
  bonusXp?: number;
  target?: number;
}

export interface StravaSyncResponse {
  processed: number;
  results: StravaSyncActivityResult[];
}

export interface PenaltyQuest {
  id: string;
  userId: string;
  date: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  xpPenalty: number;
  completed: boolean;
  expired: boolean;
}
