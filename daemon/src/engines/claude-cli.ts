import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSubproc } from '../subproc/spawn.js';
import type { ClaudeCallResult, ClaudeModel, TokenUsage } from '../types.js';
import type { LLMEngine, EngineCallOpts } from './types.js';
import type { ClaudeCliEngineConfig } from '../config/types.js';
import { tryParseJsonLoose } from './json-parse.js';

const ROLE_TIMEOUTS_MS: Record<string, number> = {
  detector: 60_000,
  vision: 60_000,
  differ: 180_000,
  implementer: 600_000,
  alignment: 60_000,
  behavioral: 180_000,
  adversarial: 180_000,
  'done-check': 180_000,
  'repo-summary': 60_000,
};

const MODEL_CLI_ID: Record<ClaudeModel, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

function stripUsageTail(stdout: string): string {
  return stdout.replace(/\r/g, '').replace(/\n?USAGE:[^\n]*\n?/g, '\n').trim();
}

export function extractTokenUsage(stdout: string): TokenUsage {
  const m = /USAGE:\s*input=(\d+)\s*output=(\d+)/.exec(stdout);
  if (m && m[1] && m[2]) {
    return { inputTokens: parseInt(m[1], 10), outputTokens: parseInt(m[2], 10) };
  }
  return { inputTokens: 0, outputTokens: 0 };
}

/**
 * On Windows, `claude` CLI (2.1+) refuses to run unless it can find git-bash,
 * either on PATH or via the CLAUDE_CODE_GIT_BASH_PATH env var. We probe the
 * common Git-for-Windows install locations and inject the var when found, so
 * the user doesn't have to set it manually.
 */
export function detectGitBashPathWindows(): string | null {
  if (process.platform !== 'win32') return null;
  const candidates: string[] = [];

  // 1. Derive from `where git` — handles users who installed Git into a
  //    non-default location (e.g. D:\Git -> D:\Git\bin\bash.exe).
  //    `where` may return multiple lines (cmd\git.exe, mingw64\bin\git.exe);
  //    bash.exe is at the install root's bin\, so we walk parents up to 3
  //    levels to cover both layouts.
  try {
    const w = spawnSync('where.exe', ['git'], { encoding: 'utf8', windowsHide: true });
    if (w.status === 0 && w.stdout) {
      const gitExes = w.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      for (const exe of gitExes) {
        if (!existsSync(exe)) continue;
        let dir = path.dirname(exe);
        for (let i = 0; i < 3; i++) {
          dir = path.dirname(dir);
          candidates.push(path.join(dir, 'bin', 'bash.exe'));
        }
      }
    }
  } catch {
    // ignore — fall through to common-path candidates
  }

  // 2. Common Git-for-Windows install locations.
  const programFiles = process.env['ProgramFiles'];
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  const localAppData = process.env['LOCALAPPDATA'];
  if (programFiles) candidates.push(path.join(programFiles, 'Git', 'bin', 'bash.exe'));
  if (programFilesX86) candidates.push(path.join(programFilesX86, 'Git', 'bin', 'bash.exe'));
  if (localAppData) candidates.push(path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'));
  candidates.push('C:\\Program Files\\Git\\bin\\bash.exe');
  candidates.push('C:\\Program Files (x86)\\Git\\bin\\bash.exe');

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function envWithGitBash(): NodeJS.ProcessEnv {
  const base = process.env;
  if (process.platform !== 'win32') return base;
  if (base['CLAUDE_CODE_GIT_BASH_PATH']) return base;
  const detected = detectGitBashPathWindows();
  if (!detected) return base;
  return { ...base, CLAUDE_CODE_GIT_BASH_PATH: detected };
}

export class ClaudeCliEngine implements LLMEngine {
  readonly id = 'claude-cli';
  private readonly bin: string;

  constructor(cfg: ClaudeCliEngineConfig) {
    this.bin = cfg.bin ?? process.env.D2P_CLAUDE_BIN ?? 'claude';
  }

  async call<T = unknown>(opts: EngineCallOpts<T>): Promise<ClaudeCallResult<T>> {
    const timeoutMs = opts.timeoutMs ?? ROLE_TIMEOUTS_MS[opts.role] ?? 120_000;
    const args = ['--model', MODEL_CLI_ID[opts.model], '-p', opts.prompt];
    const r = await runSubproc({ cmd: this.bin, args, cwd: opts.cwd, env: envWithGitBash(), timeoutMs });
    if (r.timedOut) {
      return { ok: false, code: 'TIMEOUT', message: `timed out after ${timeoutMs}ms`, raw: r.stdout };
    }
    if (r.spawnError && /ENOENT/.test(r.spawnError)) {
      return { ok: false, code: 'CLAUDE_NOT_FOUND', message: r.spawnError, raw: '' };
    }
    if (r.exitCode !== 0) {
      return {
        ok: false,
        code: 'NON_ZERO_EXIT',
        message: `exit ${r.exitCode}: ${r.stderr.slice(0, 500)}`,
        raw: r.stdout,
      };
    }
    const cleaned = stripUsageTail(r.stdout);
    let json: unknown;
    try {
      // Real `claude` often wraps JSON in markdown fences or chats before/after
      // the JSON answer even when the prompt says "output JSON only". Use the
      // forgiving parser shared with openai-compat.
      json = tryParseJsonLoose(cleaned);
    } catch (e) {
      return { ok: false, code: 'NON_JSON', message: (e as Error).message, raw: r.stdout };
    }
    if (opts.schemaCheck && !opts.schemaCheck(json)) {
      return { ok: false, code: 'SCHEMA', message: 'schema check failed', raw: r.stdout };
    }
    return { ok: true, json: json as T, raw: r.stdout, usage: extractTokenUsage(r.stdout) };
  }

  async probe(): Promise<{ ok: boolean; detail?: string }> {
    const r = await runSubproc({ cmd: this.bin, args: ['--version'], env: envWithGitBash(), timeoutMs: 5000 });
    return r.exitCode === 0 && !r.spawnError
      ? { ok: true, detail: r.stdout.trim() }
      : { ok: false, detail: r.spawnError ?? (r.stderr.trim() || `exit ${r.exitCode}`) };
  }
}
