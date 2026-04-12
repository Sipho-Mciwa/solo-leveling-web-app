'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { QuestProvider } from '@/context/QuestContext';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';

export default function HomePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [loading, firebaseUser, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (!firebaseUser) return null;

  return (
    <QuestProvider>
      <div className="min-h-screen bg-bg">
        <Header />
        <Dashboard />
      </div>
    </QuestProvider>
  );
}
