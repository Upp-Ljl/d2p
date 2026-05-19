import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionResumeBanner, mockResumeMark } from './SessionResumeBanner.js';

const DEFAULT_PROPS = {
  gapTitle: 'agent self-routing scoring (iter-2 §3)',
  gapSlug: 'agent-self-routing-scoring',
  pausedHoursAgo: 3,
  onResume: vi.fn(),
  onDiscard: vi.fn(),
  onLater: vi.fn(),
};

describe('SessionResumeBanner', () => {
  it('renders the banner with gap title and hours ago', () => {
    render(<SessionResumeBanner {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('session-resume-banner')).toBeTruthy();
    expect(screen.getByText(/agent self-routing scoring/)).toBeTruthy();
    expect(screen.getByText(/3 小时前/)).toBeTruthy();
  });

  it('calls onResume when 继续 is clicked', () => {
    const onResume = vi.fn();
    render(<SessionResumeBanner {...DEFAULT_PROPS} onResume={onResume} />);
    fireEvent.click(screen.getByTestId('resume-continue'));
    expect(onResume).toHaveBeenCalled();
  });

  it('calls onDiscard when 放弃 is clicked', () => {
    const onDiscard = vi.fn();
    render(<SessionResumeBanner {...DEFAULT_PROPS} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByTestId('resume-discard'));
    expect(onDiscard).toHaveBeenCalled();
  });

  it('calls onLater when 稍后 is clicked', () => {
    const onLater = vi.fn();
    render(<SessionResumeBanner {...DEFAULT_PROPS} onLater={onLater} />);
    fireEvent.click(screen.getByTestId('resume-later'));
    expect(onLater).toHaveBeenCalled();
  });
});

describe('mockResumeMark', () => {
  it('is non-null for demo mode', () => {
    expect(mockResumeMark).not.toBeNull();
    expect(mockResumeMark.gapSlug).toBe('agent-self-routing-scoring');
  });
});
