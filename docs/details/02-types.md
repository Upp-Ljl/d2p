# 02 — Shared TypeScript Types

> 跨 workspace 共享的核心类型，统一放 `daemon/src/types.ts`，ui / cli 通过 `import type` 引。
> 改类型 = 改 API 契约，同时更新 04-api.md、03-storage.md。

## Enums (字面量并集)

```ts
export type ProjectType =
  | 'saas-web'
  | 'api-service'
  | 'cli-tool'
  | 'library'
  | 'static-site'
  | 'mobile'
  | 'desktop-app'
  | 'ml-script'
  | 'unknown';

export type SessionStatus = 'SETUP' | 'LOOPING' | 'PAUSED' | 'DONE' | 'ENDED';

export type GapStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'SKIPPED'
  | 'NEED_HUMAN'
  | 'SPLIT_DONE';

export type FixStatus =
  | 'STARTED'
  | 'IMPLEMENTING'
  | 'STATIC_GATE_RUNNING'
  | 'STATIC_GATE_FAILED'
  | 'ALIGNMENT_RUNNING'
  | 'ALIGNMENT_FAILED'
  | 'BEHAVIORAL_RUNNING'
  | 'BEHAVIORAL_FAILED'
  | 'ADVERSARIAL_RUNNING'
  | 'ADVERSARIAL_FAILED'
  | 'MERGED'
  | 'DROPPED';

export type GapCategory =
  | 'auth'
  | 'input-validation'
  | 'sql'
  | 'ipc'
  | 'file-ops'
  | 'network'
  | 'crypto'
  | 'deploy'
  | 'data'
  | 'tests'
  | 'docs'
  | 'ui'
  | 'perf'
  | 'err'
  | 'polish'
  | 'misc';

export const HIGH_SENSITIVITY_CATEGORIES: ReadonlySet<GapCategory> = new Set([
  'auth', 'input-validation', 'sql', 'ipc', 'file-ops', 'network', 'crypto', 'deploy',
]);

export type Severity = 'P1' | 'P2' | 'P3';

export type GapSource = 'preset' | 'vision' | 'both';

export type ReviewKind = 'alignment' | 'behavioral' | 'adversarial';

export type Verdict = 'APPROVE' | 'RETRY_WITH_HINTS' | 'ROLLBACK' | 'ESCALATE';

export type ReasonCode =
  | 'OK'
  | 'DIVERGES_FROM_GAP'
  | 'BUGGY'
  | 'INCOMPLETE'
  | 'OVER_SCOPED'
  | 'ARCHITECTURAL'
  | 'SCOPE_TOO_LARGE'
  | 'TOO_HARD';

export type ClaudeRole =
  | 'detector'
  | 'vision'
  | 'differ'
  | 'implementer'
  | 'alignment'
  | 'behavioral'
  | 'adversarial'
  | 'done-check'
  | 'repo-summary';

export type ClaudeModel = 'haiku' | 'sonnet' | 'opus';

export type LogEventKind =
  | 'SESSION_STARTED'
  | 'VISION_QUESTION_ASKED'
  | 'VISION_ANSWERED'
  | 'VISION_FINALIZED'
  | 'TYPE_DETECTED'
  | 'PRESET_CHOSEN'
  | 'DIFF_PRODUCED'
  | 'GAP_PICKED'
  | 'WORKTREE_CREATED'
  | 'AGENT_START'
  | 'AGENT_THOUGHT'
  | 'AGENT_END'
  | 'STATIC_GATE_PASSED'
  | 'STATIC_GATE_FAILED'
  | 'ALIGNMENT_RESULT'
  | 'REVIEW_VERDICT'
  | 'ADVERSARIAL_RESULT'
  | 'FIX_COMMITTED'
  | 'FIX_DROPPED'
  | 'MERGED'
  | 'GAP_DONE'
  | 'GAP_SKIPPED'
  | 'GAP_ESCALATED'
  | 'LOOP_STARTED'
  | 'LOOP_PAUSED'
  | 'LOOP_RESUMED'
  | 'DONE_CHECK_RESULT'
  | 'SESSION_DONE'
  | 'SESSION_ENDED'
  | 'ERROR';
```

## Domain Entities

```ts
export interface Demo {
  id: number;
  path: string;                   // absolute, normalized
  firstSeenAt: number;            // unix ms
  lastSessionAt: number | null;
  inferredType: ProjectType | null;
}

export interface Session {
  id: number;
  demoId: number;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  visionMdPath: string | null;    // absolute path to vision.md
  presetType: ProjectType | null;
}

export interface VisionDraft {
  id: number;
  sessionId: number;
  roundIndex: number;
  questionId: string;
  question: string;
  answer: string;
  createdAt: number;
}

export interface Gap {
  id: number;
  sessionId: number;
  slug: string;
  title: string;
  body: string;
  category: GapCategory;
  severity: Severity;
  source: GapSource;
  suggestedApproach: string;
  expectedFilesChanged: string[];
  status: GapStatus;
  dynamicK: number | null;        // set after first behavioral review
  parentGapId: number | null;     // for split gaps
  createdAt: number;
  finishedAt: number | null;
}

export interface Fix {
  id: number;
  gapId: number;
  attempt: number;                // 1-based
  branch: string;                 // e.g. fix/auth-signup
  worktreePath: string;
  commitSha: string | null;
  staticGatePassed: boolean | null;
  alignmentScore: number | null;
  reviewerVerdict: Verdict | null;
  reasonCode: ReasonCode | null;
  status: FixStatus;
  stderrExcerpt: string | null;
  filesChanged: string[];
  confidence: number | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface Review {
  id: number;
  fixId: number;
  kind: ReviewKind;
  model: ClaudeModel;
  verdict: Verdict | null;        // alignment uses ALIGN_* mapped to RETRY/APPROVE; adversarial uses BREAK→ROLLBACK
  hints: string[];
  reasonCode: ReasonCode | null;
  difficulty: number | null;      // behavioral only
  splitInto: SplitGapSpec[] | null;
  rawJson: string;                // full agent JSON for audit
  createdAt: number;
}

export interface SplitGapSpec {
  slug: string;
  title: string;
  body: string;
}

export interface LogEvent {
  id: number;
  sessionId: number;
  ts: number;
  level: 'info' | 'warn' | 'error';
  kind: LogEventKind;
  payload: Record<string, unknown>;
}

export interface CostRecord {
  id: number;
  sessionId: number;
  role: ClaudeRole;
  model: ClaudeModel;
  inputTokens: number;
  outputTokens: number;
  ts: number;
}

export interface PresetStatusItem {
  item: string;                   // slug from preset
  status: 'done' | 'partial' | 'missing';
  note: string | null;
}
```

## Agent IO Types

```ts
// P-01 Detector
export interface DetectorOutput {
  type: ProjectType;
  confidence: number;
  evidence: string[];
  presetCandidates: ProjectType[];
  inferredCheckCommands: {
    build: string;
    test: string;
    typecheck: string;
  };
}

// P-02 Vision Elicitor
export type VisionRoundOutput =
  | { done: false; questions: VisionQuestion[] }
  | { done: true; visionMd: string };

export interface VisionQuestion {
  id: string;
  question: string;
  options: { label: string; description: string }[];
}

// P-03 Differ
export interface DifferOutput {
  gaps: DifferGap[];
  presetStatus: PresetStatusItem[];
}

export interface DifferGap {
  slug: string;
  title: string;
  body: string;
  category: GapCategory;
  severity: Severity;
  source: GapSource;
  suggestedApproach: string;
  expectedFilesChanged: string[];
}

// P-04 Implementer
export interface ImplementerOutput {
  filesChanged: string[];
  commandsRun: string[];
  testOutputExcerpt: string;
  commitSha: string;
  residualRisks: string[];
  confidence: number;
}

// P-05 Alignment
export interface AlignmentOutput {
  alignment: number;
  addressesGap: boolean;
  scopeCreep: boolean;
  concerns: string[];
}

// P-06 Behavioral
export interface BehavioralOutput {
  verdict: Verdict;
  confidence: number;
  reasonCode: ReasonCode;
  rationale: string;
  hints: string[];
  splitInto: SplitGapSpec[] | null;
  difficulty: number;
}

// P-07 Adversarial
export interface AdversarialOutput {
  attempts: AdversarialAttempt[];
  anyBreak: boolean;
}

export interface AdversarialAttempt {
  vector: string;
  scenario: string;
  broke: boolean;
  evidence: string;
}

// P-08 Done-check
export interface DoneCheckOutput {
  visionSatisfied: boolean;
  rationale: string;
  remainingThemes: RemainingTheme[];
}

export interface RemainingTheme {
  theme: string;
  whyMissing: string;
  suggestedGapSlug: string;
}

// P-09 Repo Summary
export interface RepoSummary {
  entryPoints: string[];
  frameworks: string[];
  testPresent: boolean;
  authPresent: boolean;
  dbPresent: 'sqlite' | 'postgres' | 'mysql' | 'in-memory' | 'none' | 'unknown';
  deployConfigPresent: boolean;
  ciPresent: boolean;
  licensePresent: boolean;
  readmeQuality: 'rich' | 'minimal' | 'none';
  notableDeps: string[];
}
```

## Subprocess types

```ts
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type ClaudeCallResult<T = unknown> =
  | { ok: true; json: T; raw: string; usage: TokenUsage }
  | {
      ok: false;
      code: 'TIMEOUT' | 'NON_JSON' | 'SCHEMA' | 'NON_ZERO_EXIT' | 'CLAUDE_NOT_FOUND';
      message: string;
      raw: string;
    };

export interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
```

## Preset types

```ts
export interface PresetFrontmatter {
  type: ProjectType | string;     // 用户自定义 type 允许字符串
  name: string;
  version: number;
  inherits?: string[];            // MVP-0 ignore
  highSensitivityCategories?: GapCategory[];
}

export interface PresetOverrides {
  add: Array<{
    slug: string;
    category: GapCategory;
    description: string;
    severity: Severity;
  }>;
  remove: string[];               // slugs
  skip: string[];                 // slugs
}
```

## API DTOs

```ts
// Session
export interface StartSessionReq {
  demoPath: string;
}
export interface StartSessionRes {
  sessionId: number;
  status: SessionStatus;
  isResume: boolean;
}

export interface CurrentSessionRes {
  session: Session | null;
  demo: Demo | null;
  presetStatus: PresetStatusItem[];
  costTotals: { inputTokens: number; outputTokens: number; estimatedUsd: number };
}

// Vision
export interface VisionAnswerReq {
  questionId: string;
  answer: string;
}
export interface VisionRoundRes {
  done: boolean;
  questions?: VisionQuestion[];
  visionMd?: string;
}

// Loop
export interface LoopActionReq { /* empty */ }

// Gaps
export interface GapsListRes {
  gaps: Gap[];
}
export interface GapSkipReq { /* empty */ }

// Preset
export interface PresetOverrideReq {
  overrides: PresetOverrides;
}

// SSE event envelope
export interface SseEnvelope {
  id: number;
  ts: number;
  kind: LogEventKind;
  payload: Record<string, unknown>;
}
```

## Branded types & invariants

```ts
// path types
type Branded<T, B> = T & { readonly __brand: B };
export type AbsPath = Branded<string, 'AbsPath'>;
export type RepoPath = Branded<string, 'RepoPath'>;
export type WorktreePath = Branded<string, 'WorktreePath'>;

export function asAbsPath(p: string): AbsPath {
  // 由 daemon/src/util/path.ts 实现 normalize + 必须绝对路径校验
  // 失败抛 Error('NotAbsolute')
  ...
}
```

**强约束**：
- `Demo.path`、`Session.visionMdPath`、`Fix.worktreePath` 均 `AbsPath`
- DB 里存 string，读出来转 brand 类型
- `Gap.slug` 强约束正则 `^[a-z][a-z0-9-]{1,63}$`，daemon 入库前校验
- `Fix.attempt` 单调递增（同 gapId 内 1, 2, 3...）；DB 约束 `UNIQUE(gap_id, attempt)`
