import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DailySnapshot from '../DailySnapshot';

vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({
    quests: [
      { id: '1', completed: true },
      { id: '2', completed: false },
    ],
  }),
}));

vi.mock('@/context/ChallengeContext', () => ({
  useChallenges: () => ({
    challengeDoc: {
      challenges: [{ key: 'a', completed: true }, { key: 'b', completed: true }, { key: 'c', completed: false }],
    },
  }),
}));

describe('DailySnapshot', () => {
  it('renders quests and challenges done-today counts', () => {
    render(<DailySnapshot />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });
});
