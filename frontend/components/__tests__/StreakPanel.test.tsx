import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StreakPanel from '../StreakPanel';

describe('StreakPanel', () => {
  it('shows "At risk" pill when streak is at risk', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk
        activePenalty={false}
        showPressure={false}
        hoursLeft={10}
        minutesLeft={0}
        questsRemaining={1}
        variant="compact"
      />
    );
    expect(screen.getByText('At risk')).toBeInTheDocument();
  });

  it('does not render penalty/pressure banners in compact variant', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk={false}
        activePenalty
        showPressure
        hoursLeft={2}
        minutesLeft={30}
        questsRemaining={2}
        variant="compact"
      />
    );
    expect(screen.queryByText(/Penalty active/)).not.toBeInTheDocument();
  });

  it('renders penalty banner in full variant', () => {
    render(
      <StreakPanel
        streakCount={3}
        streakAtRisk={false}
        activePenalty
        showPressure={false}
        hoursLeft={10}
        minutesLeft={0}
        questsRemaining={0}
        variant="full"
      />
    );
    expect(screen.getByText(/Penalty active/)).toBeInTheDocument();
  });
});
