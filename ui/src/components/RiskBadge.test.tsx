import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskBadge, riskCardRingClass } from './RiskBadge.js';
import { mockRiskByCommitSha } from '../mock/risk.js';

describe('RiskBadge', () => {
  it('renders low risk chip with correct label', () => {
    const risk = mockRiskByCommitSha['22a7654']!;
    render(<RiskBadge risk={risk} />);
    expect(screen.getByText('低风险')).toBeTruthy();
    expect(screen.getByTestId('risk-badge-22a7654')).toBeTruthy();
  });

  it('renders mid risk chip with correct label', () => {
    const risk = mockRiskByCommitSha['4944fba']!;
    render(<RiskBadge risk={risk} />);
    expect(screen.getByText('中风险')).toBeTruthy();
  });

  it('renders high risk chip with correct label', () => {
    const risk = mockRiskByCommitSha['c5eeedb']!;
    render(<RiskBadge risk={risk} />);
    expect(screen.getByText(/高风险/)).toBeTruthy();
  });

  it('shows popover with reasons on hover for high-risk', () => {
    const risk = mockRiskByCommitSha['c5eeedb']!;
    render(<RiskBadge risk={risk} />);
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    // reasons should appear
    expect(screen.getByText(/风险原因/)).toBeTruthy();
  });
});

describe('riskCardRingClass', () => {
  it('returns empty string for low risk', () => {
    const risk = mockRiskByCommitSha['22a7654']!;
    expect(riskCardRingClass(risk)).toBe('');
  });

  it('returns ring class for high risk', () => {
    const risk = mockRiskByCommitSha['c5eeedb']!;
    const cls = riskCardRingClass(risk);
    expect(cls).toContain('ring');
  });

  it('returns empty string for undefined risk', () => {
    expect(riskCardRingClass(undefined)).toBe('');
  });
});
