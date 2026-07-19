'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { QuestProvider } from '@/context/QuestContext';
import { ChallengeProvider } from '@/context/ChallengeContext';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import LoadingScreen from '@/components/LoadingScreen';

export default function DashboardPage() {
  const { firebaseUser, loading } = useRequireAuth();

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
