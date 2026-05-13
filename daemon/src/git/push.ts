// Push a fix branch to the demo's `origin` remote, using a PAT-in-URL so we
// don't depend on the user's GCM / SSH key being available to the daemon
// process. The PAT is masked in any returned error / log strings.

import { git } from '../subproc/git.js';

const SAFE_BRANCH = /^[a-zA-Z0-9._/-]+$/;

export interface PushResult {
  ok: boolean;
  remoteRef: string;
  stderr: string;
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '…' + token.slice(-4);
}

function maskInString(s: string, token: string): string {
  if (!token) return s;
  return s.split(token).join(maskToken(token));
}

/**
 * `repoPath` is the demo's git work-tree; `branch` is e.g. `fix/auth-signup`.
 * Pushes via `https://x-access-token:<token>@github.com/owner/repo.git`.
 * Existing `origin` URL is parsed for owner/repo; we don't rely on having
 * the origin URL contain credentials.
 */
export async function pushFixBranch(input: {
  repoPath: string;
  branch: string;
  token: string;
  owner: string;
  repo: string;
}): Promise<PushResult> {
  if (!SAFE_BRANCH.test(input.branch)) {
    return { ok: false, remoteRef: '', stderr: 'invalid branch name' };
  }
  // If the demo's `origin` already points at github.com, inject the PAT into
  // the URL so we don't depend on the user's GCM. For local file:// or other
  // remotes (smoke tests, self-hosted gitea, etc.), push to `origin` as-is.
  const origin = await readOriginUrl(input.repoPath);
  let pushTarget: string;
  if (origin && /github\.com/.test(origin)) {
    pushTarget = `https://x-access-token:${input.token}@github.com/${input.owner}/${input.repo}.git`;
  } else if (origin) {
    pushTarget = 'origin';
  } else {
    return { ok: false, remoteRef: '', stderr: 'no origin remote configured' };
  }
  const r = await git(
    ['push', '--set-upstream', pushTarget, `${input.branch}:${input.branch}`],
    input.repoPath,
    { timeoutMs: 90_000 },
  );
  return {
    ok: r.exitCode === 0,
    remoteRef: `refs/heads/${input.branch}`,
    stderr: maskInString(r.stderr, input.token),
  };
}

export async function readOriginUrl(repoPath: string): Promise<string | null> {
  const r = await git(['remote', 'get-url', 'origin'], repoPath, { timeoutMs: 5000 });
  if (r.exitCode !== 0) return null;
  return r.stdout.trim();
}
