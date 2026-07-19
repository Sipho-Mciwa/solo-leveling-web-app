'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message.includes('invalid-credential')
          ? 'Incorrect email or password'
          : err instanceof Error
          ? err.message
          : 'Authentication failed'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface overflow-hidden px-6 py-8 sm:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            {isSignUp ? 'New Hunter Registration' : 'Authenticate to Access the System'}
          </h1>
          <p className="text-muted text-sm mt-2">Level up every day.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-system transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-system transition-colors"
          />

          {error && <p className="text-danger text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/80 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Loading...' : isSignUp ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted text-xs">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-bg border border-border hover:border-system/50 disabled:opacity-40 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          Continue with Google
        </button>

        <p className="text-center text-xs text-muted mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-system-light hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
