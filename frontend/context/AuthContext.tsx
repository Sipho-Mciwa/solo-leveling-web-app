'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { fetchUserProfile, generateDailyQuests, generatePenalty, generateDailyChallenges, syncStravaOnLogin, UserProfile } from '@/lib/api';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(user: User) {
    try {
      const profile = await fetchUserProfile(user.email ?? undefined);
      setUserProfile(profile);
      // Run all generation tasks in parallel on login/session restore
      await Promise.all([
        generateDailyQuests(),
        generatePenalty(),
        generateDailyChallenges(),
      ]);
      // Fire-and-forget: sync Strava in background without blocking login
      syncStravaOnLogin().catch(() => {});
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }

  async function refreshProfile() {
    if (!firebaseUser) return;
    const profile = await fetchUserProfile(firebaseUser.email ?? undefined);
    setUserProfile(profile);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
