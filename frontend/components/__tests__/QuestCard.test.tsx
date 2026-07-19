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
  test('shows the running quest title and km unit keyed by questId, not title', () => {
    render(<QuestCard quest={makeQuest()} />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add km')).toBeInTheDocument();
  });

  test('falls back to the default icon for a custom quest with an unmapped questId', () => {
    const { container } = render(
      <QuestCard quest={makeQuest({ questId: 'custom_abc123', title: 'Meditate', isCustom: true })} />
    );
    expect(screen.getByText('Meditate')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add reps')).toBeInTheDocument();
    // Falls back to the Zap icon (lucide-react renders it with this class).
    expect(container.querySelector('.lucide-zap')).toBeInTheDocument();
  });

  test('renders reps unit for a non-running default quest', () => {
    const { container } = render(
      <QuestCard quest={makeQuest({ questId: 'default_push_ups', title: 'Push-ups' })} />
    );
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add reps')).toBeInTheDocument();
    expect(container.querySelector('.lucide-dumbbell')).toBeInTheDocument();
  });
});
