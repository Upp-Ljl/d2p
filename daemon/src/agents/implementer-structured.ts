// Implementer for engines that can't execute tools (openai-compat /
// anthropic-api). The model returns an edit plan as JSON; d2p applies the
// edits, stages them, and commits. The model never touches the filesystem.

import path from 'node:path';
import { mkdir, writeFile, unlink, readFile, readdir, stat } from 'node:fs/promises';
import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { StructuredImplementerOutputSchema } from '../prompts/schemas.js';
import { git } from '../subproc/git.js';
import type { Gap, ImplementerOutput } from '../types.js';

export interface StructuredImplementerInput {
  gap: Gap;
  visionMd: string;
  worktreePath: string;
  retryHints: string[];
}

const SNAPSHOT_MAX_BYTES = 8000;
const PER_FILE_HEAD_LINES = 80;
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.d2p', '.d2p-worktrees', 'dist', 'build', '.next', '.vite', 'coverage',
]);

async function repoSnapshot(root: string): Promise<string> {
  const tree: string[] = [];
  const fileHeads: string[] = [];
  let totalBytes = 0;

  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > 3 || totalBytes >= SNAPSHOT_MAX_BYTES) return;
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      const rel = path.posix.join(prefix, e.name);
      tree.push(e.isDirectory() ? rel + '/' : rel);
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), depth + 1, rel);
      } else if (totalBytes < SNAPSHOT_MAX_BYTES) {
        try {
          const buf = await readFile(path.join(dir, e.name), 'utf8');
          if (/[\x00-\x08\x0e-\x1f]/.test(buf.slice(0, 200))) continue; // skip binary
          const head = buf.split(/\r?\n/).slice(0, PER_FILE_HEAD_LINES).join('\n');
          const block = `<file:${rel}>\n${head}\n</file:${rel}>`;
          const remaining = SNAPSHOT_MAX_BYTES - totalBytes;
          const slice = block.slice(0, Math.max(0, remaining));
          if (slice) {
            fileHeads.push(slice);
            totalBytes += slice.length;
          }
        } catch { /* unreadable */ }
      }
    }
  }
  await walk(root, 0, '');
  return `<tree>\n${tree.join('\n')}\n</tree>\n\n${fileHeads.join('\n\n')}`;
}

async function applyEditPlan(
  worktreePath: string,
  edits: Array<{ path: string; action: 'write'; content: string } | { path: string; action: 'delete' }>,
): Promise<{ ok: true; touched: string[] } | { ok: false; error: string }> {
  const touched: string[] = [];
  for (const e of edits) {
    const full = path.join(worktreePath, e.path);
    if (!full.startsWith(worktreePath + path.sep) && full !== worktreePath) {
      return { ok: false, error: `path escape: ${e.path}` };
    }
    if (e.action === 'write') {
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, e.content, 'utf8');
      touched.push(e.path);
    } else {
      try {
        await stat(full);
        await unlink(full);
        touched.push(e.path);
      } catch {
        // delete-of-nonexistent is non-fatal
      }
    }
  }
  return { ok: true, touched };
}

export async function runStructuredImplementer(
  q: Queries,
  sessionId: number,
  fixId: number,
  input: StructuredImplementerInput,
): Promise<ImplementerOutput | { error: string }> {
  const snapshot = await repoSnapshot(input.worktreePath);

  const result = await runAgent<unknown>(q, {
    role: 'implementer-structured',
    model: 'sonnet',
    sessionId,
    gapId: input.gap.id,
    fixId,
    timeoutMs: 300_000,
    promptInputs: {
      gap_title: input.gap.title,
      gap_slug: input.gap.slug,
      gap_category: input.gap.category,
      gap_body: input.gap.body,
      suggested_approach: input.gap.suggestedApproach,
      expected_files_changed: JSON.stringify(input.gap.expectedFilesChanged),
      vision_md: input.visionMd,
      retry_hints: input.retryHints.length ? input.retryHints.join('\n') : '(no prior attempts)',
      repo_snapshot: snapshot,
    },
    thoughtSummary: `structured implementer 上手 ${input.gap.slug}`,
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };

  const parsed = StructuredImplementerOutputSchema.safeParse(result.json);
  if (!parsed.success) {
    return { error: `schema: ${parsed.error.message.slice(0, 400)}` };
  }

  const apply = await applyEditPlan(input.worktreePath, parsed.data.edits);
  if (!apply.ok) return { error: `apply: ${apply.error}` };

  // git add + commit
  const add = await git(['add', '-A'], input.worktreePath, { timeoutMs: 30_000 });
  if (add.exitCode !== 0) return { error: `git add: ${add.stderr.slice(0, 200)}` };

  // refuse to commit if nothing actually changed
  const diff = await git(['diff', '--cached', '--quiet'], input.worktreePath, { timeoutMs: 10_000 });
  if (diff.exitCode === 0) {
    return { error: 'no changes staged after applying edit plan' };
  }

  const commit = await git(
    ['-c', 'user.email=d2p@local', '-c', 'user.name=d2p', 'commit', '-q', '-m', parsed.data.commit_message],
    input.worktreePath,
    { timeoutMs: 30_000 },
  );
  if (commit.exitCode !== 0) return { error: `git commit: ${commit.stderr.slice(0, 200)}` };

  const rev = await git(['rev-parse', 'HEAD'], input.worktreePath, { timeoutMs: 5000 });
  const sha = rev.stdout.trim();

  return {
    filesChanged: apply.touched,
    commandsRun: [`git add -A`, `git commit -m "${parsed.data.commit_message.split('\n')[0]}"`],
    testOutputExcerpt: '',
    commitSha: sha,
    residualRisks: parsed.data.residual_risks,
    confidence: parsed.data.confidence,
  };
}
