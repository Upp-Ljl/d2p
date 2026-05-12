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

export async function runAdversarial(
  q: Queries,
  sessionId: number,
  fixId: number,
  gap: Gap,
  fullDiff: string,
  staticGateOutput: string,
): Promise<AdversarialOutput | { error: string }> {
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
