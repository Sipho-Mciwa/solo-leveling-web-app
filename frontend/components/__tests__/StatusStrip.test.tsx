import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatusStrip from '../StatusStrip';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { rank: 'D', streakCount: 3 },
  }),
}));

vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({
    quests: [{ id: '1', title: 'Run 5km', completed: false, currentValue: 1, targetValue: 5 }],
    loading: false,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchRankProgress: vi.fn().mockResolvedValue({
    metCount: 1, totalCount: 3, nextRank: 'C', criteria: [],
  }),
}));

describe('StatusStrip', () => {
  it('renders compact rank bar, streak, and next objective once data loads', async () => {
    render(<StatusStrip />);
    await waitFor(() => {
      expect(screen.getByText('1/3 conditions met for C-Rank')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    expect(screen.getByText('Run 5km')).toBeInTheDocument();
  });
});
