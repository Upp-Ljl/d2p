# 01 — Agent Prompts

> d2p 全部 AI 调用走 `claude --model X -p "<prompt>"`。每个角色的 prompt 在此固定。
> Prompt 改动 = behavior 改动，必须升 `prompts.version`（写在 `daemon/src/prompts/version.ts`），便于日后做 prompt regression 测试。
> 当前 `prompts.version = 1`。

## 通用契约

所有 prompts 遵守：

1. **必须输出 JSON only**——无 prose、无 ```json fence。daemon 端 `JSON.parse(stdout)`。
2. **JSON schema** 在文件头说明，agent 不许加字段、不许漏字段。
3. **失败时**输出 `{"error": "<code>", "message": "..."}`，daemon 走错误路径。
4. **大语境数据**（如 vision.md 全文、repo 摘要）放 prompt 中显式 BEGIN / END 标记包裹，防注入：
   ```
   <vision-md-begin>
   {{vision_md}}
   <vision-md-end>
   ```
5. Prompt 不含 instructions 让 agent "解释你的推理"——CoT 占 token 又没用，直接要 JSON。
6. Agent 看到 `{{X}}` 是 daemon 注入的占位符，daemon 注入前需 escape 反引号 + dollar，并保证 begin/end 标记不在用户输入中。

## P-01 Project Detector

**模型**：`haiku`
**调用频率**：session 起步 1 次
**输入注入**：
- `{{tree_dump}}`: 目录 tree（深 ≤3，黑名单 `node_modules .git dist build .next`），每行 `<path>` 或 `<path>/`
- `{{manifests}}`: 关键 manifest 拼接（package.json / Cargo.toml / pyproject.toml / go.mod / Gemfile / pom.xml / build.gradle / requirements.txt / setup.py），每个文件前缀 `<file:path>` 后缀 `</file>`，整体 ≤ 8KB（超 head 截断）
- `{{readme_head}}`: README 头 ≤ 100 行（若有）

**Prompt**：

```
You analyze a code repository and identify its product type.

<tree-begin>
{{tree_dump}}
<tree-end>

<manifests-begin>
{{manifests}}
<manifests-end>

<readme-begin>
{{readme_head}}
<readme-end>

Identify the project type from this fixed set:
  saas-web | api-service | cli-tool | library | static-site | mobile | desktop-app | ml-script | unknown

Output JSON only, no other text, matching this schema:
{
  "type": "<one of the set above>",
  "confidence": <float 0..1>,
  "evidence": ["<short bullet>", "<short bullet>", "..."],
  "preset_candidates": ["<type1>", "<type2>"],
  "inferred_check_commands": {
    "build": "<command or empty string>",
    "test": "<command or empty string>",
    "typecheck": "<command or empty string>"
  }
}

Rules:
- evidence: 3-8 bullets, each <= 15 words, concrete (file names, deps, conventions)
- preset_candidates: top 2 plausible types in priority order
- inferred_check_commands: empty string if no command applies (e.g. python projects without npm)
- If genuinely unsure, type="unknown" with confidence reflecting that
```

**Parse**：JSON only。`type` 不在固定集 → fallback `unknown`，记 log warn。

## P-02 Vision Elicitor (per round)

**模型**：`haiku`
**调用频率**：vision elicit 每轮 1 次（≤5 轮）
**输入注入**：
- `{{detected_type}}`: detector 出的 type
- `{{tree_short}}`: 目录 tree（深 ≤2，更短）
- `{{drafts_so_far}}`: 已收集的 vision 片段 JSON 数组（每个 `{question, answer}`）
- `{{round_index}}`: 当前轮号（1-5）

**Prompt**：

```
You are eliciting a product vision from the user by asking focused questions.

Detected project type: {{detected_type}}

Repository tree (shallow):
<tree-begin>
{{tree_short}}
<tree-end>

Drafts collected so far:
<drafts-begin>
{{drafts_so_far}}
<drafts-end>

Round {{round_index}} of 5 max.

Decide: continue eliciting OR finalize.

If continuing, output JSON only:
{
  "done": false,
  "questions": [
    {
      "id": "<short-kebab-id>",
      "question": "<one Chinese sentence>",
      "options": [
        {"label": "<short Chinese label>", "description": "<one Chinese sentence>"},
        ...
      ]
    },
    ...
  ]
}

If finalizing, output JSON only:
{
  "done": true,
  "vision_md": "<full markdown of the vision document>"
}

Rules:
- 1-3 questions per round, A/B/C/D options each (3-4 options), no open-ended
- Cover: target user, core scenarios, business model, KPI, explicit non-goals
- Don't repeat topics already in drafts
- Stop and finalize when: 5 rounds reached OR drafts cover all 5 themes above
- vision_md sections: ## 产品定位 / ## 目标用户 / ## 核心场景 / ## 商业模式 / ## KPI / ## 明确不做
- All user-facing text in Chinese
- Question id format: <round>-<theme>-<n>, e.g. "r2-monetize-1"
```

**Parse**：`done=true` → 锁 vision；`done=false` → 推送问题给 UI。

## P-03 Gap Differ

**模型**：`sonnet`
**调用频率**：loop 每次 re-diff、initial diff 1 次
**输入注入**：
- `{{vision_md}}`: 完整 `vision.md`
- `{{preset_md}}`: 选定 preset 原文
- `{{preset_overrides}}`: `preset-overrides.yaml` 内容（可能为空）
- `{{repo_summary}}`: daemon 生成的 repo 摘要（文件树 + 关键文件 head 50 行 + 测试输出近况）
- `{{done_gap_history}}`: 已 DONE / SKIPPED / NEED_HUMAN 的 gap slug + title 列表（避免重复）

**Prompt**：

```
You diff a code repository against a vision and a preset checklist to identify gaps.

<vision-begin>
{{vision_md}}
<vision-end>

<preset-begin>
{{preset_md}}
<preset-end>

<preset-overrides-begin>
{{preset_overrides}}
<preset-overrides-end>

<repo-summary-begin>
{{repo_summary}}
<repo-summary-end>

<history-begin>
{{done_gap_history}}
<history-end>

Output JSON only, no other text:
{
  "gaps": [
    {
      "slug": "<kebab-case-unique-id>",
      "title": "<one sentence Chinese>",
      "body": "<2-5 sentence Chinese, includes context and suggested approach>",
      "category": "<auth|input-validation|sql|ipc|file-ops|network|crypto|deploy|data|tests|docs|ui|perf|err|polish|misc>",
      "severity": "P1|P2|P3",
      "source": "preset|vision|both",
      "suggested_approach": "<one paragraph English, concrete>",
      "expected_files_changed": ["<path glob>", "..."]
    }
  ],
  "preset_status": [
    {"item": "<slug from preset>", "status": "done|partial|missing", "note": "<optional>"}
  ]
}

Rules:
- gap slug must not collide with any in history; if a topic already DONE, exclude
- Maximum 12 gaps per call; pick highest-impact
- severity P1 = blocks done-check; P2 = important polish; P3 = nice-to-have
- category from the fixed set; categories listed are high-sensitivity (auth/input-validation/sql/ipc/file-ops/network/crypto/deploy)
- expected_files_changed: realistic file path globs the implementer is likely to touch
- preset_status: include EVERY item from preset (and any from overrides.add), one entry each
```

**Parse**：每个 gap 入 `gaps` 表，`preset_status` 入 `preset_status_history` 表。

## P-04 Implementer

**模型**：`sonnet`（reviewer 在 escalate 时可强制 `opus`）
**调用频率**：每个 gap attempt 1 次
**调用方式**：worktree 已切到 `fix/<slug>` 分支；`claude` spawn 时 `cwd = <worktree path>`，prompt 让 agent 在当前目录直接写文件 + git commit
**输入注入**：
- `{{gap_title}}`, `{{gap_body}}`, `{{gap_category}}`, `{{gap_slug}}`, `{{suggested_approach}}`, `{{expected_files_changed}}`
- `{{vision_md}}`（用作背景）
- `{{worktree_path}}`
- `{{retry_hints}}`: 上一轮 reviewer hints（首次为空）

**Prompt**：

```
You are an implementer. Your task: implement ONE gap end-to-end in this git worktree.

Working directory: {{worktree_path}}
You may read/write/delete files within this directory only.
You may run shell commands (npm, git, etc.) here.
You must end with exactly one git commit on the current branch.

<gap-begin>
title: {{gap_title}}
slug: {{gap_slug}}
category: {{gap_category}}
body: {{gap_body}}
suggested approach: {{suggested_approach}}
expected files to change: {{expected_files_changed}}
<gap-end>

<vision-begin>
{{vision_md}}
<vision-end>

<retry-hints-begin>
{{retry_hints}}
<retry-hints-end>

Instructions:
1. Read enough of the codebase to understand context (focus on expected_files_changed paths).
2. Implement the gap. Stay narrowly within scope—do NOT touch unrelated files.
3. Run any relevant tests / typecheck. Fix what you broke.
4. Create exactly ONE commit using:
     git add <only the files you intentionally changed>
     git commit -m "<conventional-commits: type(scope): subject>" -m "<body explaining why>"
5. After committing, output JSON only (no prose):

{
  "files_changed": ["<path>", "..."],
  "commands_run": ["<command>", "..."],
  "test_output_excerpt": "<last ~30 lines of test/build stdout, or empty if none ran>",
  "commit_sha": "<full sha from git rev-parse HEAD>",
  "residual_risks": ["<bullet>", "..."],
  "confidence": <float 0..1>
}

Rules:
- DO NOT touch .d2p/, .d2p-worktrees/, .git/hooks/, package-lock.json (unless adding a new dep)
- DO NOT git push, git reset --hard, git rebase, or alter remote refs
- DO NOT modify files in expected_files_changed's PARENT dirs unless strictly necessary
- DO NOT install new dependencies unless the gap clearly needs them; if you do, run npm install with explicit version pin
- conventional-commits types: feat|fix|chore|docs|test|refactor|perf
- residual_risks: be honest about edge cases / things you couldn't verify
```

**Parse**：JSON parse；`commit_sha` 与 `git rev-parse HEAD` 必须一致（daemon 复核）。

## P-05 Alignment Probe (Reviewer Layer 2)

**模型**：`haiku`
**调用频率**：每 attempt 1 次（Static Gate 通过后）
**输入注入**：
- `{{gap_title}}`, `{{gap_body}}`, `{{suggested_approach}}`
- `{{diff_summary}}`: `git diff main..HEAD` 输出（>100KB 时按文件分块取前 N，daemon 端预处理）

**Prompt**：

```
You score how well a code change matches the stated gap. Fast scan, no deep audit.

<gap-begin>
title: {{gap_title}}
body: {{gap_body}}
suggested approach: {{suggested_approach}}
<gap-end>

<diff-begin>
{{diff_summary}}
<diff-end>

Output JSON only:
{
  "alignment": <float 0..1>,
  "addresses_gap": true|false,
  "scope_creep": true|false,
  "concerns": ["<one-line>", "..."]
}

Rules:
- alignment >= 0.7 means proceed to behavioral review; < 0.7 means RETRY_WITH_HINTS
- addresses_gap: did the diff actually do the thing the gap asked for?
- scope_creep: did it touch unrelated files / add unrelated features?
- concerns: brief bullets, no prose
```

**Parse**：`alignment < 0.7` 或 `scope_creep=true` → RETRY，hints 从 `concerns` 拼。

## P-06 Behavioral Reviewer (Reviewer Layer 3)

**模型**：`sonnet`（reviewer.confidence < 0.7 时同 gap 升 `opus`）
**调用频率**：每 attempt 1 次（alignment 通过后）
**Fresh context** 强约束：spawn 独立 `claude -p`，不带历史，prompt 自给自足
**输入注入**：
- `{{gap_title}}`, `{{gap_body}}`, `{{gap_category}}`, `{{suggested_approach}}`
- `{{vision_md}}`
- `{{full_diff}}`: `git diff main..HEAD`
- `{{static_gate_output}}`: 测试 / build / typecheck 的真实 stdout/stderr 拼接
- `{{implementer_residuals}}`: implementer 自述 residual_risks

**Prompt**：

```
You are an independent code reviewer. You have not seen the implementer's reasoning.
Audit this change against the gap and the project vision.

<gap-begin>
title: {{gap_title}}
slug: {{gap_slug}}
category: {{gap_category}}
body: {{gap_body}}
suggested approach: {{suggested_approach}}
<gap-end>

<vision-begin>
{{vision_md}}
<vision-end>

<diff-begin>
{{full_diff}}
<diff-end>

<static-gate-output-begin>
{{static_gate_output}}
<static-gate-output-end>

<implementer-residuals-begin>
{{implementer_residuals}}
<implementer-residuals-end>

Output JSON only:
{
  "verdict": "APPROVE|RETRY_WITH_HINTS|ROLLBACK|ESCALATE",
  "confidence": <float 0..1>,
  "reason_code": "OK|DIVERGES_FROM_GAP|BUGGY|INCOMPLETE|OVER_SCOPED|ARCHITECTURAL|SCOPE_TOO_LARGE|TOO_HARD",
  "rationale": "<one paragraph>",
  "hints": ["<actionable line>", "..."],
  "split_into": null,
  "difficulty": <1..5>
}

Decision rules:
- APPROVE: gap clearly addressed, no obvious bugs, scope tight, tests pass.
- RETRY_WITH_HINTS: implementation is wrong/incomplete BUT a clear fix path exists; hints must be concrete.
- ROLLBACK: implementation is harmful or fundamentally broken; cannot be salvaged with a hint.
- ESCALATE: implementation is beyond AI scope right now (architectural decision, missing info).

reason_code mapping:
- OK -> APPROVE
- DIVERGES_FROM_GAP / BUGGY / INCOMPLETE -> RETRY_WITH_HINTS or ROLLBACK
- OVER_SCOPED -> RETRY_WITH_HINTS (hints must include "remove these unrelated changes")
- ARCHITECTURAL -> ESCALATE (loop will pause for user)
- SCOPE_TOO_LARGE -> ESCALATE, MUST fill split_into with 2-4 child gaps
- TOO_HARD -> ESCALATE, gap will be marked NEED_HUMAN

difficulty (1-5): used for retry budget. 1=trivial, 5=major refactor.

If verdict=ESCALATE AND reason_code=SCOPE_TOO_LARGE, populate split_into:
[{"slug": "<kebab>", "title": "<one sentence>", "body": "<2-3 sentences>"}, ...]
Otherwise split_into=null.

Be strict: a half-working fix is RETRY, not APPROVE.
```

**Parse**：严格按 schema。`verdict` 不在枚举 → 视作 ROLLBACK + log error。

## P-07 Adversarial Reviewer (Reviewer Layer 4)

**模型**：`sonnet`（gap.category ∈ {auth, crypto} 时升 `opus`）
**调用频率**：仅高敏 gap（preset frontmatter `high_sensitivity_categories` 或 behavioral.confidence < 0.85）
**Fresh context**
**输入注入**：同 P-06

**Prompt**：

```
You are a security/QA adversary. Your goal: find an input or scenario that breaks this fix.

<gap-begin>
title: {{gap_title}}
category: {{gap_category}}
body: {{gap_body}}
<gap-end>

<diff-begin>
{{full_diff}}
<diff-end>

<static-gate-output-begin>
{{static_gate_output}}
<static-gate-output-end>

Step 1: List 3 attack vectors (specific to this fix, not generic).
Step 2: For each vector, describe a concrete scenario / input that would exercise it.
Step 3: Decide whether the fix as-written would survive each scenario.

Output JSON only:
{
  "attempts": [
    {
      "vector": "<one sentence>",
      "scenario": "<concrete input or sequence>",
      "broke": true|false,
      "evidence": "<one paragraph reasoning citing diff lines>"
    },
    {...},
    {...}
  ],
  "any_break": true|false
}

Rules:
- Be specific. "What if the input is empty?" only counts if you cite WHERE empty input flows in this diff.
- broke=true only if you can point to specific diff lines that would fail; otherwise broke=false.
- Generic attacks ("SQL injection in general") don't count unless this diff actually has an injection surface.
```

**Parse**：`any_break=true` → 视作 ROLLBACK，hints = 所有 `broke=true` 的 `vector` 列表。

## P-08 Done-Check Vision Evaluator

**模型**：`sonnet`（preset 第一次全绿后第一次跑用 `opus`）
**调用频率**：每次 fix MERGE 后
**输入注入**：
- `{{vision_md}}`
- `{{preset_status_summary}}`: 当前 preset 全 item 状态
- `{{done_gap_summary}}`: 已完成 gap slug + title 列表
- `{{repo_summary_compact}}`: 浅扫摘要

**Prompt**：

```
You judge whether a product vision has been substantially satisfied by the current state of a repository.

<vision-begin>
{{vision_md}}
<vision-end>

<preset-status-begin>
{{preset_status_summary}}
<preset-status-end>

<done-gaps-begin>
{{done_gap_summary}}
<done-gaps-end>

<repo-summary-begin>
{{repo_summary_compact}}
<repo-summary-end>

Output JSON only:
{
  "vision_satisfied": true|false,
  "rationale": "<one paragraph>",
  "remaining_themes": [
    {"theme": "<short>", "why_missing": "<one sentence>", "suggested_gap_slug": "<kebab>"}
  ]
}

Rules:
- "satisfied" means: a reasonable user reading the vision and looking at the repo would say "yes, this delivers".
- Don't be a perfectionist; "polished and complete" satisfaction is fine even if some nice-to-haves remain.
- remaining_themes: list ONLY themes from the vision NOT yet substantially addressed. Empty array if satisfied.
- If remaining_themes non-empty, vision_satisfied=false.
```

**Parse**：`vision_satisfied=true` AND preset all `done` → loop DONE。`remaining_themes` 用于下次 differ 输入。

## P-09 Repo Summarizer (internal helper)

**模型**：`haiku`
**调用频率**：differ / done-check 前若摘要过期（>5 min 或有新 commit）则重算
**输入注入**：`{{tree_dump}}` (深 4)、`{{file_heads}}`（关键文件 head 100 行）
**Prompt**：

```
You summarize a repository for downstream agents in compact JSON.

<tree-begin>
{{tree_dump}}
<tree-end>

<files-begin>
{{file_heads}}
<files-end>

Output JSON only:
{
  "entry_points": ["<path>", "..."],
  "frameworks": ["<name>", "..."],
  "test_present": true|false,
  "auth_present": true|false,
  "db_present": "<sqlite|postgres|mysql|in-memory|none|unknown>",
  "deploy_config_present": true|false,
  "ci_present": true|false,
  "license_present": true|false,
  "readme_quality": "<rich|minimal|none>",
  "notable_deps": ["<dep>", "..."]
}
```

**Parse**：缓存到 `runs.repo_summary_json`，5 分钟 TTL。

## 通用调用模板

`daemon/src/subproc/spawn.ts` 暴露：

```ts
async function callClaude(opts: {
  role: 'detector' | 'vision' | 'differ' | 'implementer'
       | 'alignment' | 'behavioral' | 'adversarial' | 'done-check' | 'repo-summary';
  model: 'haiku' | 'sonnet' | 'opus';
  promptInputs: Record<string, string>;
  cwd?: string;                   // implementer 用 worktree path
  sessionId: number;
  gapId?: number;
  fixId?: number;
  timeoutMs?: number;             // 默认见下表
}): Promise<ClaudeCallResult>;

type ClaudeCallResult =
  | { ok: true; json: unknown; raw: string; usage: TokenUsage }
  | { ok: false; code: 'TIMEOUT' | 'NON_JSON' | 'SCHEMA' | 'NON_ZERO_EXIT' | 'CLAUDE_NOT_FOUND'; message: string; raw: string };
```

| role | 默认 timeout |
|---|---|
| detector / vision / alignment / repo-summary | 60s |
| differ / done-check | 180s |
| behavioral / adversarial | 180s |
| implementer | 600s |

超时即 NON_ZERO_EXIT，按各角色失败路径走。

## Prompt 注入安全

- daemon 注入前对用户输入（vision drafts、preset overrides、demo path）：
  - 拒绝包含 `<vision-end>` / `<diff-end>` / 任何 prompt 内已用 end-tag 的字符串（reject + log）
  - path 不让进 prompt 文本，只进 `cwd` 参数
- agent 输出 JSON 解析失败 → 不重试 prompt，直接归为 NON_JSON 错误
- 不依赖 prompt 内的"don't"约束做安全防线——文件系统访问由 `claude --cwd` 限定 + git worktree 隔离硬约束
