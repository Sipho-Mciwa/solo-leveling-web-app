'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { QuestProvider } from '@/context/QuestContext';
import { ChallengeProvider } from '@/context/ChallengeContext';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import LoadingScreen from '@/components/LoadingScreen';

export default function DashboardPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.push('/login');
    }
  }, [loading, firebaseUser, router]);

  if (loading) return <LoadingScreen />;

  if (!firebaseUser) return null;

  return (
    <QuestProvider>
      <ChallengeProvider>
        <div className="min-h-screen bg-bg">
          <Header />
          <Dashboard />
        </div>
      </ChallengeProvider>
    </QuestProvider>
  );
}
