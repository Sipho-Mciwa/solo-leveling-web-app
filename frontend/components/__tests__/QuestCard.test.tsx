import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuestCard from '../QuestCard';
import type { DailyQuest } from '@/lib/api';

vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({ updateProgress: vi.fn() }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ refreshProfile: vi.fn() }),
}));

function makeQuest(overrides: Partial<DailyQuest> = {}): DailyQuest {
  return {
    id: 'dq1',
    userId: 'u1',
    questId: 'default_running',
    date: '2026-01-01',
    currentValue: 0,
    completed: false,
    title: 'Running',
    type: 'fitness',
    targetValue: 5,
    xpReward: 50,
    isCustom: false,
    ...overrides,
  };
}

describe('QuestCard', () => {
  test('shows the running icon and km unit keyed by questId, not title', () => {
    render(<QuestCard quest={makeQuest()} />);
    expect(screen.getByText('🏃')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add km')).toBeInTheDocument();
  });

  test('falls back to the default icon for a custom quest with an unmapped questId', () => {
    render(<QuestCard quest={makeQuest({ questId: 'custom_abc123', title: 'Meditate', isCustom: true })} />);
    expect(screen.getByText('⚡')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add reps')).toBeInTheDocument();
  });

  test('renders reps unit for a non-running default quest', () => {
    render(<QuestCard quest={makeQuest({ questId: 'default_push_ups', title: 'Push-ups' })} />);
    expect(screen.getByText('💪')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add reps')).toBeInTheDocument();
  });
});
