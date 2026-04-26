'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import HunterCard from '@/components/HunterCard';
import SystemFeed from '@/components/SystemFeed';
import LoadingScreen from '@/components/LoadingScreen';

export default function HomePage() {
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
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="max-w-sm mx-auto px-6 py-10">
        <HunterCard />
        <SystemFeed />
      </main>
    </div>
  );
}
