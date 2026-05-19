import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MilestonesPanel } from './MilestonesPanel.js';
import { mockMilestones, getMilestoneKpi } from '../mock/milestones.js';

describe('MilestonesPanel', () => {
  it('renders the panel with milestone steps', () => {
    render(<MilestonesPanel milestones={mockMilestones} />);
    expect(screen.getByTestId('milestones-panel')).toBeTruthy();
    // M1 Lobby should be visible
    expect(screen.getByText('Lobby')).toBeTruthy();
    // M5 Polish (in-progress) should be visible
    expect(screen.getByText('Polish')).toBeTruthy();
  });

  it('shows all 6 milestone steps', () => {
    render(<MilestonesPanel milestones={mockMilestones} />);
    const steps = ['M1-lobby', 'M2-watch', 'M3-social', 'M4-agents', 'M5-polish', 'M6-ship'];
    for (const id of steps) {
      expect(screen.getByTestId(`milestone-step-${id}`)).toBeTruthy();
    }
  });

  it('expands vision excerpt on step click', () => {
    render(<MilestonesPanel milestones={mockMilestones} />);
    const step = screen.getByTestId('milestone-step-M1-lobby');
    fireEvent.click(step);
    // Should show the vision excerpt (truncated, but text appears)
    expect(screen.getByText(/NL_HOLDEM_SNG/i)).toBeTruthy();
  });

  it('calls onClose if provided', () => {
    const onClose = vi.fn();
    render(<MilestonesPanel milestones={mockMilestones} onClose={onClose} />);
    const btn = screen.getByText('收起 ✕');
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('getMilestoneKpi', () => {
  it('calculates correct done count', () => {
    const kpi = getMilestoneKpi(mockMilestones);
    // M1, M2, M3, M4 are done = 4
    expect(kpi.done).toBe(4);
    expect(kpi.total).toBe(6);
  });

  it('calculates percentage correctly', () => {
    const kpi = getMilestoneKpi(mockMilestones);
    expect(kpi.pct).toBe(Math.round((4 / 6) * 100));
  });
});
