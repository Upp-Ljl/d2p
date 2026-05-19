import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CorePathsAlert } from './CorePathsAlert.js';
import { sampleCorePathHits } from '../mock/corePaths.js';

describe('CorePathsAlert', () => {
  it('renders the modal with hit count', () => {
    render(
      <CorePathsAlert
        hits={sampleCorePathHits}
        onAllow={vi.fn()}
        onVeto={vi.fn()}
      />
    );
    expect(screen.getByTestId('core-paths-alert')).toBeTruthy();
    expect(screen.getByText(/动了 2 处核心代码/)).toBeTruthy();
  });

  it('shows changed file paths', () => {
    render(
      <CorePathsAlert
        hits={sampleCorePathHits}
        onAllow={vi.fn()}
        onVeto={vi.fn()}
      />
    );
    expect(screen.getByText('lib/themes.ts')).toBeTruthy();
    expect(screen.getByText('lib/agent-routing.ts')).toBeTruthy();
  });

  it('calls onAllow when allow button clicked', () => {
    const onAllow = vi.fn();
    render(
      <CorePathsAlert hits={sampleCorePathHits} onAllow={onAllow} onVeto={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId('core-paths-allow'));
    expect(onAllow).toHaveBeenCalled();
  });

  it('calls onVeto when veto button clicked', () => {
    const onVeto = vi.fn();
    render(
      <CorePathsAlert hits={sampleCorePathHits} onAllow={vi.fn()} onVeto={onVeto} />
    );
    fireEvent.click(screen.getByTestId('core-paths-veto'));
    expect(onVeto).toHaveBeenCalled();
  });
});
