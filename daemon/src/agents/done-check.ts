import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { DoneCheckOutputSchema } from '../prompts/schemas.js';
import type { DoneCheckOutput } from '../types.js';

export interface DoneCheckInput {
  visionMd: string;
  presetStatusSummary: string;
  doneGapSummary: string;
  repoSummaryCompact: string;
}

export async function runDoneCheck(
  q: Queries,
  sessionId: number,
  input: DoneCheckInput,
): Promise<DoneCheckOutput | { error: string }> {
  const result = await runAgent<unknown>(q, {
    role: 'done-check',
    model: 'sonnet',
    sessionId,
    promptInputs: {
      vision_md: input.visionMd,
      preset_status_summary: input.presetStatusSummary,
      done_gap_summary: input.doneGapSummary,
      repo_summary_compact: input.repoSummaryCompact,
    },
    thoughtSummary: '判定 vision 是否满足',
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = DoneCheckOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  return {
    visionSatisfied: parsed.data.vision_satisfied,
    rationale: parsed.data.rationale,
    remainingThemes: parsed.data.remaining_themes.map((t) => ({
      theme: t.theme,
      whyMissing: t.why_missing,
      suggestedGapSlug: t.suggested_gap_slug,
    })),
  };
}
