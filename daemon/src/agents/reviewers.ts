import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import {
  AlignmentOutputSchema,
  BehavioralOutputSchema,
  AdversarialOutputSchema,
} from '../prompts/schemas.js';
import type {
  AdversarialOutput,
  AlignmentOutput,
  BehavioralOutput,
  Gap,
  ReasonCode,
  SplitGapSpec,
  Verdict,
} from '../types.js';

export async function runAlignment(
  q: Queries,
  sessionId: number,
  fixId: number,
  gap: Gap,
  diffSummary: string,
): Promise<AlignmentOutput | { error: string }> {
  const result = await runAgent<unknown>(q, {
    role: 'alignment',
    model: 'haiku',
    sessionId,
    gapId: gap.id,
    fixId,
    promptInputs: {
      gap_title: gap.title,
      gap_body: gap.body,
      suggested_approach: gap.suggestedApproach,
      diff_summary: diffSummary,
    },
    thoughtSummary: 'alignment 快检',
  });
  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = AlignmentOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  return {
    alignment: parsed.data.alignment,
    addressesGap: parsed.data.addresses_gap,
    scopeCreep: parsed.data.scope_creep,
    concerns: parsed.data.concerns,
  };
}

export interface BehavioralInput {
  gap: Gap;
  visionMd: string;
  fullDiff: string;
  staticGateOutput: string;
  implementerResiduals: string;
}

export async function runBehavioral(
  q: Queries,
  sessionId: number,
  fixId: number,
  input: BehavioralInput,
): Promise<BehavioralOutput | { error: string }> {
  const result = await runAgent<unknown>(q, {
    role: 'behavioral',
    model: 'sonnet',
    sessionId,
    gapId: input.gap.id,
    fixId,
    promptInputs: {
      gap_title: input.gap.title,
      gap_slug: input.gap.slug,
      gap_category: input.gap.category,
      gap_body: input.gap.body,
      suggested_approach: input.gap.suggestedApproach,
      vision_md: input.visionMd,
      full_diff: input.fullDiff,
      static_gate_output: input.staticGateOutput,
      implementer_residuals: input.implementerResiduals,
    },
    thoughtSummary: 'behavioral 深审',
  });
  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = BehavioralOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  const splitInto: SplitGapSpec[] | null = parsed.data.split_into;
  return {
    verdict: parsed.data.verdict as Verdict,
    confidence: parsed.data.confidence,
    reasonCode: parsed.data.reason_code as ReasonCode,
    rationale: parsed.data.rationale,
    hints: parsed.data.hints,
    splitInto,
    difficulty: parsed.data.difficulty,
  };
}

/**
 * Cross-engine second pass. Spawn an independent behavioral reviewer (fresh
 * context, same prompt) and compare against the first verdict. Used on
 * high-sensitivity gaps where reviewer disagreement should force a rollback.
 *
 * Returns null when the two reviewers agree (proceed with the original
 * verdict); a forced-ROLLBACK BehavioralOutput when they disagree; or an
 * error envelope on transport failure.
 */
export async function runCrossEngineCheck(
  q: Queries,
  sessionId: number,
  fixId: number,
  input: BehavioralInput,
  firstVerdict: BehavioralOutput,
): Promise<BehavioralOutput | { error: string } | null> {
  const second = await runBehavioral(q, sessionId, fixId, input);
  if ('error' in second) return second;
  if (second.verdict === firstVerdict.verdict && second.reasonCode === firstVerdict.reasonCode) {
    return null;
  }
  const hints = [
    `Cross-engine disagreement: pass1=${firstVerdict.verdict}/${firstVerdict.reasonCode}, pass2=${second.verdict}/${second.reasonCode}`,
    ...firstVerdict.hints,
    ...second.hints,
  ];
  return {
    verdict: 'ROLLBACK' as Verdict,
    confidence: Math.min(firstVerdict.confidence, second.confidence),
    reasonCode: 'BUGGY' as ReasonCode,
    rationale: `Two independent reviewers disagreed; rolled back. P1: ${firstVerdict.rationale} | P2: ${second.rationale}`,
    hints,
    splitInto: null,
    difficulty: Math.max(firstVerdict.difficulty, second.difficulty),
  };
}

/**
 * Demo / fixture override for runAdversarial. When `ZEROU_ADVERSARIAL_FIXTURE=1`
 * is set (or `loopCaps.adversarialFixture` is true via config in the future),
 * the reviewer returns a deterministic attack pattern:
 *   - attempt 1 on this fix → BREAK with one category-appropriate attack vector
 *   - attempt 2+ → PASS (so the retry path proves the loop heals itself)
 * This makes the M2 "adversarial 打回 → 重写过" demo moment 100% reproducible,
 * which a real LLM-based adversarial can't guarantee within a 2-min video.
 */
function adversarialFixtureForGap(category: Gap['category']): AdversarialOutput {
  const attackByCategory: Record<string, { vector: string; scenario: string; evidence: string }> = {
    auth: {
      vector: 'session-fixation',
      scenario: '攻击者诱导用户使用预先持有的 session id 登录',
      evidence: '/api/auth/callback 接收 ?session= 参数后未轮换 cookie',
    },
    'input-validation': {
      vector: 'SQL-injection-via-array',
      scenario: '攻击者传入数组而非字符串，绕过参数化查询的预期类型',
      evidence: 'req.query.id 直接拼接到 ORDER BY，无类型校验',
    },
    sql: {
      vector: 'SQL-injection-via-array',
      scenario: '攻击者传入数组而非字符串，绕过参数化查询的预期类型',
      evidence: 'req.query.id 直接拼接到 ORDER BY，无类型校验',
    },
    crypto: {
      vector: 'weak-hash-roundtrip',
      scenario: '攻击者重放历史 cookie，hash 算法可逆',
      evidence: 'sha1 用于密码 hash，未加盐',
    },
  };
  const attack =
    attackByCategory[category as string] ?? {
      vector: 'race-condition',
      scenario: '并发写入导致最后一次胜出，丢失中间状态',
      evidence: 'POST /api/x 没有事务，两个并发请求都通过校验',
    };
  return {
    attempts: [
      {
        vector: attack.vector,
        scenario: attack.scenario,
        broke: true,
        evidence: attack.evidence,
      },
    ],
    anyBreak: true,
  };
}

function adversarialFixturePass(): AdversarialOutput {
  return {
    attempts: [
      {
        vector: 'session-fixation',
        scenario: 'recheck after retry — token rotation now in place',
        broke: false,
        evidence: 'fix added Set-Cookie rotate + checked in test',
      },
    ],
    anyBreak: false,
  };
}

function isAdversarialFixtureEnabled(): boolean {
  return process.env.ZEROU_ADVERSARIAL_FIXTURE === '1';
}

export async function runAdversarial(
  q: Queries,
  sessionId: number,
  fixId: number,
  gap: Gap,
  fullDiff: string,
  staticGateOutput: string,
): Promise<AdversarialOutput | { error: string }> {
  if (isAdversarialFixtureEnabled()) {
    const fix = q.getFix(fixId);
    const attempt = fix?.attempt ?? 1;
    return attempt === 1 ? adversarialFixtureForGap(gap.category) : adversarialFixturePass();
  }

  const result = await runAgent<unknown>(q, {
    role: 'adversarial',
    model: 'sonnet',
    sessionId,
    gapId: gap.id,
    fixId,
    promptInputs: {
      gap_title: gap.title,
      gap_category: gap.category,
      gap_body: gap.body,
      full_diff: fullDiff,
      static_gate_output: staticGateOutput,
    },
    thoughtSummary: 'adversarial 找漏洞',
  });
  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = AdversarialOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  return {
    attempts: parsed.data.attempts,
    anyBreak: parsed.data.any_break,
  };
}
