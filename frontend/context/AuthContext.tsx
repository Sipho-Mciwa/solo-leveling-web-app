'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { fetchUserProfile, generateDailyQuests, generatePenalty, generateDailyChallenges, UserProfile } from '@/lib/api';

// This is a single-user personal app. The backend's authenticate middleware
// is the real security boundary (it rejects any other account's requests
// regardless of this check) — this just gives an unauthorized sign-in a
// clear message and an immediate sign-out instead of a page full of failed
// API calls.
const ALLOWED_EMAIL = 'siphomciwa@gmail.com';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  authError: null,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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
      if (user && user.email !== ALLOWED_EMAIL) {
        setAuthError('This app is restricted to a single authorized account.');
        await signOut(auth);
        setFirebaseUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      if (user) {
        setAuthError(null);
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
    <AuthContext.Provider value={{ firebaseUser, userProfile, loading, authError, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
