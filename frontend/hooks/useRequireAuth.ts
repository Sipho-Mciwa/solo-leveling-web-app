'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Redirects to /login once the auth state has resolved and no user is
 * signed in. Returns the same { firebaseUser, loading } shape as useAuth()
 * so pages can gate their render on `loading` without duplicating the
 * redirect effect themselves.
 */
export function useRequireAuth() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [loading, firebaseUser, router]);

  return { firebaseUser, loading };
}
