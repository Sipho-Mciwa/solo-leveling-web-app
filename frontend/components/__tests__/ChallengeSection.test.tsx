import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeSection from '../ChallengeSection';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
const acceptAISuggestion = vi.fn().mockResolvedValue({ status: 'accepted' });
const completeAISuggestion = vi.fn().mockResolvedValue({ completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

// Stable object reference so ChallengeSection's `useEffect(..., [firebaseUser])`
// doesn't refire (and re-fetch/reset suggestions) on every render.
const firebaseUser = { uid: 'u1' };

vi.mock('@/context/ChallengeContext', () => ({
  useChallenges: () => ({
    challengeDoc: { id: 'doc-1', challenges: [], bonusAwarded: false },
    loading: false,
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser,
    refreshProfile,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchAIChallenges: vi.fn().mockResolvedValue({
    challenges: [
      { title: 'Daily Focus Protocol', description: 'Maintain focus sessions.', xpReward: 25, status: 'suggested' },
    ],
  }),
  acceptAISuggestion: (...args: unknown[]) => acceptAISuggestion(...args),
  completeAISuggestion: (...args: unknown[]) => completeAISuggestion(...args),
}));

describe('ChallengeSection — AI suggestion card', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    acceptAISuggestion.mockClear();
    completeAISuggestion.mockClear();
  });

  it('accepts, then completes, a suggestion via two taps', async () => {
    render(<ChallengeSection />);

    const card = await screen.findByRole('button', { name: /Daily Focus Protocol/i });

    fireEvent.click(card);
    await waitFor(() => expect(acceptAISuggestion).toHaveBeenCalledWith(0));
    await screen.findByText(/tap to complete/i);

    fireEvent.click(card);
    await waitFor(() => expect(completeAISuggestion).toHaveBeenCalledWith(0));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    await waitFor(() => expect(card).toBeDisabled());
  });
});
