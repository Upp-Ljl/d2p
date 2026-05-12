import path from 'node:path';
import { existsSync } from 'node:fs';
import { git } from '../subproc/git.js';
import { computeWorktreePath } from '../util/path.js';

export class MergeConflictError extends Error {
  constructor(public slug: string, public stderr: string) {
    super(`merge conflict on fix/${slug}: ${stderr.slice(0, 200)}`);
    this.name = 'MergeConflictError';
  }
}

const COMMIT_ENV = ['-c', 'user.email=d2p@local', '-c', 'user.name=d2p'];

export async function ensureRepo(demoPath: string): Promise<void> {
  if (!existsSync(path.join(demoPath, '.git'))) {
    const init = await git(['init', '-q', '-b', 'main'], demoPath);
    if (init.exitCode !== 0) throw new Error(`git init failed: ${init.stderr}`);
  }
  // ensure there is at least one commit so worktrees can branch
  const rev = await git(['rev-parse', '--verify', 'HEAD'], demoPath);
  if (rev.exitCode !== 0) {
    await git(['add', '-A'], demoPath);
    const commit = await git(
      [...COMMIT_ENV, 'commit', '-q', '--allow-empty', '-m', 'chore: d2p initial commit'],
      demoPath,
    );
    if (commit.exitCode !== 0) throw new Error(`initial commit failed: ${commit.stderr}`);
  }
}

export async function getMainBranch(repoPath: string): Promise<string> {
  const sym = await git(['symbolic-ref', '--short', 'HEAD'], repoPath);
  if (sym.exitCode === 0 && sym.stdout.trim()) return sym.stdout.trim();
  for (const candidate of ['main', 'master']) {
    const ref = await git(['rev-parse', '--verify', candidate], repoPath);
    if (ref.exitCode === 0) return candidate;
  }
  throw new Error('cannot determine main branch');
}

export async function isClean(repoPath: string): Promise<boolean> {
  const r = await git(['status', '--porcelain'], repoPath);
  return r.exitCode === 0 && r.stdout.trim() === '';
}

export async function createFixWorktree(repoPath: string, slug: string): Promise<string> {
  await ensureRepo(repoPath);
  const main = await getMainBranch(repoPath);
  const wt = computeWorktreePath(repoPath, slug);

  // Clean up stale worktree/branch if any
  await git(['worktree', 'remove', '--force', wt], repoPath);
  await git(['branch', '-D', `fix/${slug}`], repoPath);

  const r = await git(['worktree', 'add', wt, '-b', `fix/${slug}`, main], repoPath);
  if (r.exitCode !== 0) throw new Error(`worktree add failed: ${r.stderr}`);
  return wt;
}

export async function mergeFix(
  repoPath: string,
  slug: string,
  gapTitle: string,
): Promise<{ mergeSha: string }> {
  const main = await getMainBranch(repoPath);
  const checkout = await git(['checkout', main], repoPath);
  if (checkout.exitCode !== 0) throw new Error(`checkout main failed: ${checkout.stderr}`);
  const merge = await git(
    [...COMMIT_ENV, 'merge', '--no-ff', `fix/${slug}`, '-m', `merge fix/${slug}: ${gapTitle}`],
    repoPath,
  );
  if (merge.exitCode !== 0) {
    await git(['merge', '--abort'], repoPath);
    throw new MergeConflictError(slug, merge.stderr);
  }
  const rev = await git(['rev-parse', 'HEAD'], repoPath);
  const sha = rev.stdout.trim();
  await git(['branch', '-d', `fix/${slug}`], repoPath);
  await git(['worktree', 'remove', computeWorktreePath(repoPath, slug)], repoPath);
  return { mergeSha: sha };
}

export async function rollbackLastCommitInWorktree(worktreePath: string): Promise<void> {
  await git(['reset', '--hard', 'HEAD^'], worktreePath);
}

export async function dropFix(repoPath: string, slug: string): Promise<void> {
  const wt = computeWorktreePath(repoPath, slug);
  await git(['worktree', 'remove', '--force', wt], repoPath);
  await git(['branch', '-D', `fix/${slug}`], repoPath);
}

export async function diffAgainstMain(worktreePath: string): Promise<string> {
  const r = await git(['diff', 'main...HEAD'], worktreePath);
  return r.stdout;
}

export async function headSha(repoPath: string): Promise<string | null> {
  const r = await git(['rev-parse', 'HEAD'], repoPath);
  return r.exitCode === 0 ? r.stdout.trim() : null;
}
