import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NextObjectiveCard from '../NextObjectiveCard';

const quest = {
  id: 'q1',
  title: 'Run 5km',
  completed: false,
  currentValue: 2,
  targetValue: 5,
  currentTarget: 5,
} as any;

describe('NextObjectiveCard', () => {
  it('renders nothing when not ready', () => {
    const { container } = render(<NextObjectiveCard quest={quest} ready={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no next quest', () => {
    const { container } = render(<NextObjectiveCard quest={null} ready />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders quest title and remaining km for a running quest', () => {
    render(<NextObjectiveCard quest={quest} ready />);
    expect(screen.getByText('Run 5km')).toBeInTheDocument();
    expect(screen.getByText('3 km remaining')).toBeInTheDocument();
  });
});
