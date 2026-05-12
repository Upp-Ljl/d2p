import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { DifferOutputSchema } from '../prompts/schemas.js';
import type { DifferOutput, GapCategory, Severity, GapSource, PresetStatusItem } from '../types.js';

export interface DifferContext {
  visionMd: string;
  presetMd: string;
  presetOverridesYaml: string;
  repoSummary: string;
  doneGapHistory: string;
}

export async function runDiffer(
  q: Queries,
  sessionId: number,
  ctx: DifferContext,
): Promise<DifferOutput | { error: string }> {
  const result = await runAgent<unknown>(q, {
    role: 'differ',
    model: 'sonnet',
    sessionId,
    promptInputs: {
      vision_md: ctx.visionMd,
      preset_md: ctx.presetMd,
      preset_overrides: ctx.presetOverridesYaml,
      repo_summary: ctx.repoSummary,
      done_gap_history: ctx.doneGapHistory,
    },
    thoughtSummary: '生成 gap 列表',
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = DifferOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };

  const gaps = parsed.data.gaps.map((g) => ({
    slug: g.slug,
    title: g.title,
    body: g.body,
    category: g.category as GapCategory,
    severity: g.severity as Severity,
    source: g.source as GapSource,
    suggestedApproach: g.suggested_approach,
    expectedFilesChanged: g.expected_files_changed,
  }));
  const presetStatus: PresetStatusItem[] = parsed.data.preset_status.map((s) => ({
    item: s.item,
    status: s.status,
    note: s.note ?? null,
  }));
  return { gaps, presetStatus };
}
