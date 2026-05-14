import { describe, it, expect } from 'vitest';
import { detectGitBashPathWindows } from './claude-cli.js';
import { existsSync } from 'node:fs';

describe('detectGitBashPathWindows', () => {
  it('returns null on non-windows', () => {
    if (process.platform === 'win32') return; // skip on win
    expect(detectGitBashPathWindows()).toBeNull();
  });

  it('returns an existing bash.exe path on windows when Git for Windows is installed', () => {
    if (process.platform !== 'win32') return; // skip on non-win
    const detected = detectGitBashPathWindows();
    // The detector must either find a real bash.exe (and the path must exist
    // on disk), or return null — never a stale string. We don't assert it's
    // found because CI may lack Git, but if it returns non-null the file MUST
    // exist (regression guard against "guesses").
    if (detected !== null) {
      expect(existsSync(detected)).toBe(true);
      expect(detected.toLowerCase().endsWith('bash.exe')).toBe(true);
    }
  });
});
