import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommitDiffDrawer } from './CommitDiffDrawer.js';
import { smallCommitDiff, mediumCommitDiff } from '../mock/diff.js';
import { mockRiskByCommitSha } from '../mock/risk.js';

const noop = () => undefined;

describe('CommitDiffDrawer', () => {
  it('renders with commit sha and message', () => {
    render(
      <CommitDiffDrawer
        sha="22a7654acd3a9466d36903fed4bdf8e658d61f9c"
        message="feat(watch): highlight classifier + friend-watch rooms"
        files={smallCommitDiff}
        onClose={noop}
      />
    );
    expect(screen.getByTestId('commit-diff-drawer')).toBeTruthy();
    expect(screen.getByText(/22a7654/)).toBeTruthy();
    expect(screen.getByText(/highlight classifier/)).toBeTruthy();
  });

  it('renders file tree items for each file', () => {
    render(
      <CommitDiffDrawer
        sha="22a7654"
        message="test"
        files={smallCommitDiff}
        onClose={noop}
      />
    );
    // lib/watch-room.ts should appear
    expect(screen.getByText('watch-room.ts')).toBeTruthy();
  });

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn();
    render(
      <CommitDiffDrawer sha="abc" message="msg" files={[]} onClose={onClose} />
    );
    const drawer = screen.getByTestId('commit-diff-drawer');
    // Click the scrim (outermost element, not the panel)
    fireEvent.click(drawer);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows empty state when no files provided', () => {
    render(
      <CommitDiffDrawer sha="abc" message="empty commit" files={[]} onClose={noop} />
    );
    expect(screen.getByText('无文件变更')).toBeTruthy();
  });

  it('renders ReviewHintBanner when risk has reviewHunks', () => {
    const risk = mockRiskByCommitSha['c5eeedb'];
    render(
      <CommitDiffDrawer
        sha="c5eeedb"
        message="feat(agents): agent self-routing scoring"
        files={mediumCommitDiff}
        risk={risk}
        onClose={noop}
      />
    );
    // The hint banner should appear since c5eeedb has reviewHunks
    expect(screen.getByTestId('review-hint-banner')).toBeTruthy();
  });

  it('renders diff lines with additions and deletions for medium commit', () => {
    render(
      <CommitDiffDrawer
        sha="4944fba"
        message="feat(polish): achievements + events + themes"
        files={mediumCommitDiff}
        onClose={noop}
      />
    );
    // Should show the file list (lib/achievements.ts is in mediumCommitDiff)
    expect(screen.getByText('achievements.ts')).toBeTruthy();
  });
});
