import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parse as parseShell } from 'shell-quote';
import { runSubproc, type SpawnResult } from '../subproc/spawn.js';

export interface CheckCommands {
  build: string;
  test: string;
  typecheck: string;
}

export interface StaticGateResult {
  passed: boolean;
  build: SpawnResult | null;
  test: SpawnResult | null;
  typecheck: SpawnResult | null;
  excerpt: string;
  failedStage: 'build' | 'test' | 'typecheck' | null;
}

function safeSplit(cmd: string): string[] | null {
  if (!cmd.trim()) return null;
  // shell-quote.parse honors quoting (so `node -e "console.log('hi')"` becomes
  // ['node', '-e', "console.log('hi')"]) and returns operator OBJECTS for any
  // shell metacharacter (`;`, `|`, `&&`, `>`, `<`, `$VAR`, etc.). If parse
  // contains anything other than plain string tokens, refuse — denylist is
  // implicit and complete.
  const tokens = parseShell(cmd, {}, { escape: '\\' });
  if (tokens.some((t) => typeof t !== 'string')) return null;
  return tokens as string[];
}

export async function readCheckCommands(
  demoOrWorktree: string,
  fallback?: Partial<CheckCommands>,
): Promise<CheckCommands> {
  const yamlPath = path.join(demoOrWorktree, '.d2p', 'check-commands.yaml');
  try {
    const raw = await readFile(yamlPath, 'utf8');
    const parsed = parseYaml(raw) as Partial<CheckCommands> | null;
    return {
      build: parsed?.build ?? fallback?.build ?? '',
      test: parsed?.test ?? fallback?.test ?? '',
      typecheck: parsed?.typecheck ?? fallback?.typecheck ?? '',
    };
  } catch {
    return {
      build: fallback?.build ?? '',
      test: fallback?.test ?? '',
      typecheck: fallback?.typecheck ?? '',
    };
  }
}

async function runOne(cmd: string, cwd: string): Promise<SpawnResult | null> {
  const tokens = safeSplit(cmd);
  if (!tokens || tokens.length === 0) return null;
  const [head, ...rest] = tokens;
  if (!head) return null;
  return runSubproc({ cmd: head, args: rest, cwd, timeoutMs: 300_000 });
}

/**
 * Detect "the tool wasn't installed / not on PATH" results vs "the tool ran
 * and reported a real failure". On Windows, spawning a missing binary often
 * surfaces as exit code -4058 (ENOENT-ish) with empty stdout/stderr; on
 * POSIX as spawnError set + exit -2. We treat these as "gate skipped" so
 * unrelated fixes (LICENSE / README / .env.example) aren't punished for the
 * project not having `tsc` reachable.
 */
function isToolUnavailable(r: SpawnResult): boolean {
  if (r.spawnError) return true;
  if (r.exitCode === null) return true;
  if (r.exitCode < 0 && !r.stdout && !r.stderr) return true;
  // Tool ran but didn't actually evaluate anything — e.g. bun got a filter that
  // matched zero files, jest "No tests found". That tells us nothing about the
  // fix's quality, so it shouldn't block.
  const blob = `${r.stdout}\n${r.stderr}`;
  if (
    /did not match any test files/i.test(blob) ||
    /no tests? found/i.test(blob) ||
    /no test files matched/i.test(blob)
  ) {
    return true;
  }
  return false;
}

function tail(s: string, lines: number): string {
  return s.split(/\r?\n/).slice(-lines).join('\n');
}

export async function runStaticGate(
  worktreePath: string,
  cmds: CheckCommands,
): Promise<StaticGateResult> {
  const order: Array<keyof CheckCommands> = ['typecheck', 'build', 'test'];
  const results: Record<keyof CheckCommands, SpawnResult | null> = {
    typecheck: null,
    build: null,
    test: null,
  };
  let failedStage: 'build' | 'test' | 'typecheck' | null = null;

  for (const stage of order) {
    const result = await runOne(cmds[stage], worktreePath);
    results[stage] = result;
    if (result && result.exitCode !== 0) {
      // Tool not available on this machine / not installed for this repo →
      // skip the stage instead of blocking the fix.
      if (isToolUnavailable(result)) {
        continue;
      }
      failedStage = stage;
      break;
    }
  }

  let excerpt: string;
  if (failedStage) {
    const r = results[failedStage]!;
    excerpt = `[${failedStage}] exit ${r.exitCode}\n${tail(r.stderr || r.stdout, 30)}`;
  } else {
    const parts: string[] = [];
    for (const stage of order) {
      const r = results[stage];
      if (r) parts.push(`[${stage}] exit ${r.exitCode}\n${tail(r.stdout, 10)}`);
    }
    excerpt = parts.join('\n') || '(no checks configured)';
  }

  return {
    passed: failedStage === null,
    build: results.build,
    test: results.test,
    typecheck: results.typecheck,
    excerpt,
    failedStage,
  };
}
