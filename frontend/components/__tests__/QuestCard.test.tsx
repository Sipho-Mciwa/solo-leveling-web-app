import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestCard from '../QuestCard';
import type { DailyQuest } from '@/lib/api';

const updateProgress = vi.fn();
vi.mock('@/context/QuestContext', () => ({
  useQuests: () => ({ updateProgress }),
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
    expect(screen.getByText('0/5 km')).toBeInTheDocument();
  });

  test('falls back to the default icon for a custom quest with an unmapped questId', () => {
    const { container } = render(
      <QuestCard quest={makeQuest({ questId: 'custom_abc123', title: 'Meditate', isCustom: true })} />
    );
    expect(screen.getByText('Meditate')).toBeInTheDocument();
    expect(screen.getByText('0/5 reps')).toBeInTheDocument();
    // Falls back to the Zap icon (lucide-react renders it with this class).
    expect(container.querySelector('.lucide-zap')).toBeInTheDocument();
  });

  test('renders reps unit for a non-running default quest', () => {
    const { container } = render(
      <QuestCard quest={makeQuest({ questId: 'default_push_ups', title: 'Push-ups' })} />
    );
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('0/5 reps')).toBeInTheDocument();
    expect(container.querySelector('.lucide-dumbbell')).toBeInTheDocument();
  });

  test('has no numeric input — clicking Complete marks the quest done at its target value', () => {
    render(<QuestCard quest={makeQuest({ currentTarget: 5 })} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(updateProgress).toHaveBeenCalledWith('dq1', 5);
  });

  test('hides the Complete button once the quest is completed', () => {
    render(<QuestCard quest={makeQuest({ completed: true, currentValue: 5 })} />);
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.getByText('Done ✓')).toBeInTheDocument();
  });
});
