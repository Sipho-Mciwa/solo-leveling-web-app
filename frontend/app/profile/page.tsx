'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import Header from '@/components/Header';
import HunterCard from '@/components/HunterCard';
import SystemFeed from '@/components/SystemFeed';
import LoadingScreen from '@/components/LoadingScreen';

export default function ProfilePage() {
  const { firebaseUser, loading } = useRequireAuth();

  if (loading) return <LoadingScreen />;

  if (!firebaseUser) return null;

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <HunterCard />
        <SystemFeed />
      </main>
    </div>
  );
}
