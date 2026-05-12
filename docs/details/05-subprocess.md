# 05 — Subprocess Contracts

> Daemon 与外界的全部接触面：`claude` CLI 子进程（AI 调用）+ `git` CLI 子进程（仓库操作）+ check command 子进程（npm test / tsc / 用户自定义）。
> 单一出口：`daemon/src/subproc/`。

## `daemon/src/subproc/spawn.ts` 通用 spawn 封装

```ts
import { spawn } from 'node:child_process';

export interface SpawnOpts {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
  encoding?: BufferEncoding;
}

export interface SpawnResult {
  exitCode: number | null;       // null on signal
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export async function runSubproc(opts: SpawnOpts): Promise<SpawnResult> {
  // implementation: spawn with detached: false, kill on timeout via SIGKILL after grace 2s
  // stdout/stderr captured to in-memory string with cap 16MB; truncate marker if exceeded
  // resolves never rejects (errors -> result with exitCode=null + stderr="<spawn-error: ...>")
}
```

**约束**：
- `cmd` 是 absolute path 或单字 binary 名；不含 shell metacharacters
- `args` 数组，永不字符串拼接（防 injection）
- 不带 shell（`shell: false`）
- timeoutMs 默认 60_000；超时发 SIGTERM，2s 后 SIGKILL
- stdout/stderr 字符串容量上限 16MB（truncate 标识 `\n[...truncated N bytes]`）

## `claude` CLI 调用

`daemon/src/subproc/claude.ts`：

```ts
import { runSubproc } from './spawn.js';
import { ClaudeRole, ClaudeModel, ClaudeCallResult } from '../types.js';
import { renderPrompt } from '../prompts/render.js';

const ROLE_TIMEOUTS: Record<ClaudeRole, number> = {
  'detector': 60_000,
  'vision': 60_000,
  'differ': 180_000,
  'implementer': 600_000,
  'alignment': 60_000,
  'behavioral': 180_000,
  'adversarial': 180_000,
  'done-check': 180_000,
  'repo-summary': 60_000,
};

export interface CallClaudeOpts<T> {
  role: ClaudeRole;
  model: ClaudeModel;
  promptInputs: Record<string, string>;
  cwd?: string;
  sessionId: number;
  gapId?: number;
  fixId?: number;
  timeoutMs?: number;
  schemaCheck?: (json: unknown) => json is T;
}

export async function callClaude<T = unknown>(opts: CallClaudeOpts<T>): Promise<ClaudeCallResult<T>> {
  const prompt = renderPrompt(opts.role, opts.promptInputs);
  const args = ['--model', mapModelToCli(opts.model), '-p', prompt];
  const started = Date.now();
  // daemon 同时 INSERT runs row (ok=0 暂)，等 result 后 UPDATE
  const result = await runSubproc({
    cmd: process.env.D2P_CLAUDE_BIN ?? 'claude',
    args,
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs ?? ROLE_TIMEOUTS[opts.role],
  });
  // 处理：
  // 1. result.timedOut -> ok:false, code:'TIMEOUT'
  // 2. exitCode === null && stderr contains 'ENOENT' -> 'CLAUDE_NOT_FOUND'
  // 3. exitCode !== 0 -> 'NON_ZERO_EXIT'
  // 4. parse stdout as JSON
  //    parse fail -> 'NON_JSON'
  // 5. schemaCheck failed -> 'SCHEMA'
  // 6. extract usage from claude CLI output (looks for /USAGE: input=NNN output=NNN/ tail line if claude exposes it; else zero)
  // 7. log to runs + cost_records
  // return ClaudeCallResult
}

function mapModelToCli(m: ClaudeModel): string {
  // 兼容 cc 当前模型 id；daemon 启动时 health 检查可以更新
  switch (m) {
    case 'haiku': return 'claude-haiku-4-5-20251001';
    case 'sonnet': return 'claude-sonnet-4-6';
    case 'opus': return 'claude-opus-4-7';
  }
}
```

### Prompt 渲染

`daemon/src/prompts/render.ts`：

```ts
export const PROMPTS_VERSION = 1;

const TEMPLATES: Record<ClaudeRole, string> = {
  'detector': /* P-01 from 01-prompts.md */,
  'vision':   /* P-02 */,
  /* ... */
};

const REQUIRED_PLACEHOLDERS: Record<ClaudeRole, string[]> = {
  'detector': ['tree_dump', 'manifests', 'readme_head'],
  /* ... */
};

const FORBIDDEN_SUBSTRINGS = [
  '<vision-end>', '<tree-end>', '<diff-end>', '<gap-end>',
  '<preset-end>', '<manifests-end>', '<readme-end>',
  '<drafts-end>', '<files-end>', '<history-end>',
  '<retry-hints-end>', '<static-gate-output-end>',
  '<implementer-residuals-end>', '<repo-summary-end>',
  '<preset-overrides-end>', '<preset-status-end>',
  '<done-gaps-end>',
];

export function renderPrompt(role: ClaudeRole, inputs: Record<string, string>): string {
  for (const key of REQUIRED_PLACEHOLDERS[role]) {
    if (!(key in inputs)) throw new Error(`missing placeholder ${key} for ${role}`);
    const value = inputs[key];
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      if (value.includes(forbidden)) {
        throw new Error(`injection attempt: placeholder ${key} contains ${forbidden}`);
      }
    }
  }
  let out = TEMPLATES[role];
  for (const [k, v] of Object.entries(inputs)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}
```

### Token usage 提取

Claude Code CLI 当前对外不一定暴露稳定 token 格式。MVP-0 策略：

1. 尝试解析 stdout 尾部最后一行 `/^USAGE: input=(\d+) output=(\d+)$/`
2. 没匹配则记 `{inputTokens: 0, outputTokens: 0}` 并 log warn 一次（同 role 后续不再 warn 避免噪音）
3. MVP-1+ 通过 `claude --json` （若届时支持）或读 cc session log 文件抓取

价格表 `daemon/src/cost/pricing.ts`：

```ts
export const PRICING_PER_MTOK: Record<ClaudeModel, {input: number; output: number}> = {
  haiku:  { input: 0.80,  output: 4.00 },
  sonnet: { input: 3.00,  output: 15.00 },
  opus:   { input: 15.00, output: 75.00 },
};
export function estimateUsd(model: ClaudeModel, usage: TokenUsage): number {
  const p = PRICING_PER_MTOK[model];
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}
```
更新策略：年度手动 review；硬编码可避免 daemon 启动联网。

## `git` CLI 调用

`daemon/src/subproc/git.ts`：

```ts
export async function git(args: string[], cwd: string, opts?: {timeoutMs?: number}): Promise<GitResult> {
  const r = await runSubproc({
    cmd: process.env.D2P_GIT_BIN ?? 'git',
    args,
    cwd,
    timeoutMs: opts?.timeoutMs ?? 30_000,
  });
  return { exitCode: r.exitCode ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// 高层 helpers in daemon/src/git/*.ts:
export async function ensureRepo(demoPath: string): Promise<void> {
  // check .git exists; if not, git init + git add -A + git commit -m "chore: d2p initial commit"
}
export async function getMainBranch(repoPath: string): Promise<string> {
  // try git symbolic-ref refs/remotes/origin/HEAD; fallback 'main' or 'master' check
}
export async function createFixWorktree(repoPath: string, slug: string): Promise<WorktreePath> {
  const wt = computeWorktreePath(repoPath, slug);  // <demoParent>/.d2p-worktrees/<demoName>-fix-<slug>
  const main = await getMainBranch(repoPath);
  // ensure clean: git diff --quiet HEAD in main; if dirty, throw
  await git(['fetch', '.', `${main}:${main}`], repoPath);
  await git(['worktree', 'add', wt, '-b', `fix/${slug}`, main], repoPath);
  return wt as WorktreePath;
}
export async function mergeFix(repoPath: string, slug: string, gapTitle: string): Promise<{mergeSha: string}> {
  const main = await getMainBranch(repoPath);
  await git(['checkout', main], repoPath);
  await git(['fetch', '.', `fix/${slug}:fix/${slug}`], repoPath);
  const r = await git(['merge', '--no-ff', `fix/${slug}`, '-m', `merge fix/${slug}: ${gapTitle}`], repoPath);
  if (r.exitCode !== 0) throw new MergeConflictError(slug, r.stderr);
  const sha = (await git(['rev-parse', 'HEAD'], repoPath)).stdout.trim();
  await git(['branch', '-d', `fix/${slug}`], repoPath);
  await git(['worktree', 'remove', computeWorktreePath(repoPath, slug)], repoPath);
  return { mergeSha: sha };
}
export async function rollbackFix(worktreePath: string): Promise<void> {
  await git(['reset', '--hard', 'HEAD^'], worktreePath);
}
export async function dropFix(repoPath: string, slug: string): Promise<void> {
  const wt = computeWorktreePath(repoPath, slug);
  await git(['worktree', 'remove', '--force', wt], repoPath).catch(()=>{});
  await git(['branch', '-D', `fix/${slug}`], repoPath).catch(()=>{});
}
```

**红线（与 Cairn worktree 红线一致）**：
- `git push` — 不调用
- `git push --force` — 不调用
- `git reset --hard` — 仅 `worktreePath` 内（rollback 一次 attempt 的 commit）；**绝不**在 `repoPath` 的 main 上调
- `git rebase` — 不调用
- `git checkout <branch>` 在 worktree 内 — 不调用（worktree 已钉分支）
- `--no-verify` — 不调用

## Check Commands（Static Gate）

`daemon/src/static-gate/check.ts`：

```ts
export interface CheckCommands {
  build: string;
  test: string;
  typecheck: string;
}

export async function readCheckCommands(demoPath: string): Promise<CheckCommands> {
  // 优先级：<demo>/.d2p/check-commands.yaml > session.preset 推断 > demo 类型默认
}

export async function runStaticGate(
  worktreePath: string,
  cmds: CheckCommands
): Promise<{
  passed: boolean;
  build: SpawnResult | null;
  test: SpawnResult | null;
  typecheck: SpawnResult | null;
  excerpt: string;          // last ~30 lines concatenated across the three
}> {
  // sequence: typecheck -> build -> test
  // each: parse cmd by shell-quote (no shell:true); run in worktreePath
  // empty string => skip that gate (count as passed)
  // any non-zero exit => passed=false; remaining gates skipped
  // excerpt: tail 30 lines from whichever failed (or tail 10 from each if all passed)
}
```

**安全**：用户填的 `check-commands.yaml` 通过 `shell-quote` 解析；不允许 `;`、`&&`、`|`、`>`；命令 binary 必须在 demo 的 `node_modules/.bin/` 或 PATH 上（不允许绝对路径）。违反 → daemon 启动时 fail-fast，UI 红条提示。

## Process tree 管理

- 所有 spawn 的子进程 daemon 维护一个 Set（pid 索引）
- daemon 收 SIGINT / SIGTERM 时，先把 set 里 pid 全发 SIGTERM，3s 后 SIGKILL，最后再退
- daemon crash recovery：启动时扫 `~/.d2p/state.db`，把 `runs` 中 `ok=0 AND finished_at IS NULL` 的标 `finished_at=now, ok=0, error_code='DAEMON_CRASH'`

## CLI 不可用降级

`/api/doctor` 检查 fail → UI 红条 + 阻止 loop start。
具体：
- `D2P_CLAUDE_BIN` 不存在 → `CLAUDE_NOT_FOUND`，提示用户安装 cc + `claude login`
- `claude -p ping` 返非 JSON 也非 zero exit → 提示「cc 未登录」
- `git --version` fail → `GIT_NOT_FOUND`
