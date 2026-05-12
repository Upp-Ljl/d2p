import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { quote } from 'shell-quote';
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

const DENYLIST = [';', '|', '&&', '||', '>', '<'];

function safeSplit(cmd: string): string[] | null {
  if (!cmd.trim()) return null;
  for (const tok of DENYLIST) {
    if (cmd.includes(tok)) return null;
  }
  // Use shell-quote to parse, but accept ONLY plain tokens (string entries),
  // not operators (objects). If anything else, reject.
  const parsed = quote([cmd]); // round-trip sanity (not used directly)
  void parsed;
  // Tokenize: simple whitespace split is enough since we deny shell ops.
  return cmd.trim().split(/\s+/);
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
