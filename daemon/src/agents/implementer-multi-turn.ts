import { Queries } from '../storage/queries.js';
import { launchStreamRun, type StreamHandle } from '../engines/claude-stream.js';
import { createMultiTurnDriver } from '../orchestrator/multi-turn.js';
import { getCcSession } from '../storage/cc-sessions.js';
import { runSubproc } from '../subproc/spawn.js';
import { emit } from '../orchestrator/controller.js';
import type { Gap, ImplementerOutput } from '../types.js';
import type Database from 'better-sqlite3';

// Multi-turn implementer — pairs with the existing single-turn runImplementer
// (agents/implementer.ts) and is dispatched only when a gap's complexity ==
// 'complex' (loop.ts decides). Replaces the single `claude --print` JSON-out
// call with a long-lived stream-json session that runs through the multi-turn
// driver (orchestrator/multi-turn.ts).
//
// Contract with the rest of the orchestrator:
//   - Same input shape as runImplementer (Gap + visionMd + worktreePath + retryHints)
//   - Same output shape (ImplementerOutput | { error }) — the reviewer pipeline
//     downstream is unchanged, so we synthesize ImplementerOutput from the
//     worktree git state after cc self-reports complete.
//
// Multi-turn implementer's contract with cc:
//   - Initial prompt instructs cc to work iteratively in the worktree, run
//     tests, fix issues, commit when ready, then say "task complete" to stop
//   - cc has full filesystem access in the worktree (bypassPermissions)
//   - When cc says complete OR we hit turn/time cap, we read the worktree HEAD
//     sha as the commit_sha and ask git for the changed-files list

export interface MultiTurnImplementerInput {
  gap: Gap;
  visionMd: string;
  worktreePath: string;
  retryHints: string[];
  /** ms cap for the whole multi-turn run (default 6h matches plan) */
  capMs?: number;
  /** max turns (default 12) */
  maxTurns?: number;
}

function buildInitialPrompt(input: MultiTurnImplementerInput): string {
  return `You are d2p's autonomous implementer running in iterative mode.

# Goal
Resolve this gap by editing files in the worktree, running tests / checks,
and self-correcting between turns. When the work is fully complete (code +
tests + (if relevant) docs in place AND verified), end your turn with the
exact phrase "task complete" so d2p can stop the loop and move to reviewer.

# Gap
- title: ${input.gap.title}
- slug:  ${input.gap.slug}
- category: ${input.gap.category} · severity: ${input.gap.severity}
- expected files: ${JSON.stringify(input.gap.expectedFilesChanged)}

## Body
${input.gap.body}

## Suggested approach
${input.gap.suggestedApproach}

# Worktree
You are in: ${input.worktreePath}

This is a real git worktree on a fix branch. You can:
- read / write files freely
- run shell commands (tests, linters, builds)
- \`git add\` / \`git commit\` your work
- run multiple turns — you do NOT have to finish in one shot

# Vision (product context, do not regress)
${input.visionMd}

# Prior attempts (if any)
${input.retryHints.length ? input.retryHints.join('\n') : '(no prior attempts)'}

# Turn 1
Start by reading the relevant files. If the gap looks tractable, make a first
pass; if not, explain what's missing in scratchpad form and stop the turn for
the next one to refine. Do NOT say "task complete" until everything is
actually working.`;
}

async function readWorktreeChanges(worktreePath: string): Promise<{
  commitSha: string | null;
  filesChanged: string[];
}> {
  // HEAD sha — first commit on the fix branch will be the implementer's
  // commit if cc did `git commit`. If cc only edited but never committed,
  // HEAD will still be the worktree base; we surface what git tells us.
  const head = await runSubproc({
    cmd: 'git',
    args: ['-C', worktreePath, 'rev-parse', 'HEAD'],
    timeoutMs: 10_000,
  });
  const commitSha = head.exitCode === 0 ? head.stdout.trim() : null;

  // Files cc actually touched relative to the branch's merge-base with main.
  // Using `git diff --name-only main...HEAD` here would require the main ref
  // to exist in the worktree; we use the working-tree diff against HEAD plus
  // status untracked so we catch un-committed edits too.
  const tracked = await runSubproc({
    cmd: 'git',
    args: ['-C', worktreePath, 'diff', '--name-only', 'HEAD'],
    timeoutMs: 10_000,
  });
  const untracked = await runSubproc({
    cmd: 'git',
    args: ['-C', worktreePath, 'ls-files', '--others', '--exclude-standard'],
    timeoutMs: 10_000,
  });
  const filesChanged = new Set<string>();
  if (tracked.exitCode === 0) tracked.stdout.split('\n').filter(Boolean).forEach((f) => filesChanged.add(f.trim()));
  if (untracked.exitCode === 0) untracked.stdout.split('\n').filter(Boolean).forEach((f) => filesChanged.add(f.trim()));

  return { commitSha, filesChanged: Array.from(filesChanged) };
}

export async function runImplementerMultiTurn(
  q: Queries,
  db: Database.Database,
  sessionId: number,
  fixId: number,
  input: MultiTurnImplementerInput,
): Promise<ImplementerOutput | { error: string }> {
  const runId = `d2p-fix-${fixId}`;
  const role = 'implementer';

  emit(q, sessionId, 'AGENT_START', {
    role,
    model: 'sonnet',
    mode: 'multi-turn',
    fixId,
    gapId: input.gap.id,
    runId,
    gapTitle: input.gap.title,
    gapSlug: input.gap.slug,
    thought: `implementer 多 turn 上手 ${input.gap.slug}`,
  });

  // Continuity: if we already have a cc-session for this run (rare for a
  // fresh fix attempt, common for crash-recovery resumes), pass it through
  // as --resume so cc reattaches its prior context.
  const priorSession = getCcSession(db, runId, role);

  const driver = createMultiTurnDriver();

  let handle: StreamHandle;
  try {
    handle = launchStreamRun(
      {
        cwd: input.worktreePath,
        prompt: buildInitialPrompt(input),
        runId,
        role,
        resumeSessionId: priorSession?.ccSessionId ?? null,
      },
      {
        onTurnDone: driver.onTurn,
        idleTimeoutMs: 10 * 60 * 1000, // 10 min between events
      },
    );
  } catch (e) {
    return { error: `stream_spawn_failed: ${(e as Error).message}` };
  }

  let result;
  try {
    result = await driver.run(db, handle, {
      runId,
      role,
      maxTurns: input.maxTurns,
      capMs: input.capMs,
    });
  } finally {
    try {
      handle.child.kill('SIGTERM');
    } catch {
      /* child already gone */
    }
  }

  emit(q, sessionId, 'AGENT_END', {
    role,
    mode: 'multi-turn',
    fixId,
    gapId: input.gap.id,
    stopReason: result.reason,
    turnsRan: result.turnsRan,
    elapsedMs: result.elapsedMs,
    thought: `multi-turn stop: ${result.reason} after ${result.turnsRan} turns`,
  });

  // stagnation / aborted / stream-error → failure path (reviewer pipeline
  // is skipped; orchestrator drops the fix and retries with hints).
  if (result.reason === 'stagnation' || result.reason === 'aborted' || result.reason === 'stream-error') {
    return { error: `multi-turn ${result.reason} after ${result.turnsRan} turns` };
  }

  // self-reported-complete / turn-cap / time-cap → harvest worktree state
  // and let reviewer pipeline decide if it's actually good.
  const { commitSha, filesChanged } = await readWorktreeChanges(input.worktreePath);

  return {
    filesChanged,
    commandsRun: [], // cc ran commands inside its own session; we don't track them
    testOutputExcerpt: '',
    commitSha: commitSha ?? '',
    residualRisks: [
      `multi-turn stopped: ${result.reason}`,
      `turns ran: ${result.turnsRan}`,
      `cc session: ${result.sessionId ?? '(none)'}`,
    ],
    confidence: result.reason === 'self-reported-complete' ? 0.7 : 0.4,
  };
}
