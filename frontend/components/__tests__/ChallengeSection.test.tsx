import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeSection from '../ChallengeSection';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
const acceptAISuggestion = vi.fn().mockResolvedValue({ status: 'accepted' });
const generateSubtasks = vi.fn().mockResolvedValue({
  subtasks: [
    { title: 'Step one', completed: false },
    { title: 'Step two', completed: false },
  ],
});
const toggleSubtask = vi.fn();
const completeAISuggestion = vi.fn().mockResolvedValue({ completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

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
      { title: 'Optimize Sleep Cycle', description: 'Adjust bedtime routine.', xpReward: 20, status: 'suggested' },
    ],
  }),
  acceptAISuggestion: (...args: unknown[]) => acceptAISuggestion(...args),
  generateSubtasks: (...args: unknown[]) => generateSubtasks(...args),
  toggleSubtask: (...args: unknown[]) => toggleSubtask(...args),
  completeAISuggestion: (...args: unknown[]) => completeAISuggestion(...args),
}));

describe('ChallengeSection — AI suggestion cards', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    acceptAISuggestion.mockClear();
    generateSubtasks.mockClear();
    toggleSubtask.mockReset();
    completeAISuggestion.mockClear();
  });

  it('locks out the other suggestion once one is accepted', async () => {
    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    await waitFor(() => expect(acceptAISuggestion).toHaveBeenCalledWith(0));

    // The second suggestion is no longer a clickable button once the first is accepted
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Optimize Sleep Cycle/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Optimize Sleep Cycle/i)).toBeInTheDocument();
  });

  it('shows a generated checklist after accepting, and completes on the last checkbox', async () => {
    toggleSubtask
      .mockResolvedValueOnce({ subtasks: [{ title: 'Step one', completed: true }, { title: 'Step two', completed: false }], completed: false })
      .mockResolvedValueOnce({ subtasks: [{ title: 'Step one', completed: true }, { title: 'Step two', completed: true }], completed: true, xp: { xp: 20, level: 1, xpGained: 20, leveledUp: false, previousLevel: 1 } });

    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    const stepOne = await screen.findByRole('button', { name: 'Step one' });
    const stepTwo = await screen.findByRole('button', { name: 'Step two' });

    fireEvent.click(stepOne);
    await waitFor(() => expect(toggleSubtask).toHaveBeenCalledWith(0, 0));
    expect(refreshProfile).not.toHaveBeenCalled();

    fireEvent.click(stepTwo);
    await waitFor(() => expect(toggleSubtask).toHaveBeenCalledWith(0, 1));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
  });

  it('renders as completed immediately if the backend reports the suggestion was already completed elsewhere', async () => {
    acceptAISuggestion.mockResolvedValueOnce({ status: 'completed' });
    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    await waitFor(() => expect(screen.queryByRole('button', { name: /Daily Focus Protocol/i })).not.toBeInTheDocument());
    expect(generateSubtasks).not.toHaveBeenCalled();
  });

  it('shows a retry option if checklist generation fails, and recovers on retry', async () => {
    generateSubtasks
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ subtasks: [{ title: 'Step one', completed: false }] });

    render(<ChallengeSection />);

    const firstCard = await screen.findByRole('button', { name: /Daily Focus Protocol/i });
    fireEvent.click(firstCard);

    const retryButton = await screen.findByRole('button', { name: /tap to retry/i });
    fireEvent.click(retryButton);

    await screen.findByRole('button', { name: 'Step one' });
    expect(generateSubtasks).toHaveBeenCalledTimes(2);
  });
});
