import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RankProgressBar from '../RankProgressBar';

const rankProgress = {
  metCount: 2,
  totalCount: 4,
  nextRank: 'C' as const,
  criteria: [
    { label: '10 quests completed', met: true, current: 10, target: 10 },
    { label: '5 streak days', met: false, current: 2, target: 5 },
  ],
};

describe('RankProgressBar', () => {
  it('renders criteria checklist in full variant', () => {
    render(<RankProgressBar rank="D" rankProgress={rankProgress} variant="full" />);
    expect(screen.getByText(/10 quests completed/)).toBeInTheDocument();
    expect(screen.getByText('2/4 conditions met for C-Rank')).toBeInTheDocument();
  });

  it('omits criteria checklist in compact variant', () => {
    render(<RankProgressBar rank="D" rankProgress={rankProgress} variant="compact" />);
    expect(screen.queryByText(/10 quests completed/)).not.toBeInTheDocument();
    expect(screen.getByText('2/4 conditions met for C-Rank')).toBeInTheDocument();
  });

  it('shows max-rank message when nextRank is null', () => {
    render(<RankProgressBar rank="S" rankProgress={{ ...rankProgress, nextRank: null }} variant="compact" />);
    expect(screen.getByText('Max rank achieved')).toBeInTheDocument();
  });
});
