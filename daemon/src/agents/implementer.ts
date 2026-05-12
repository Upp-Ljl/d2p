import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { ImplementerOutputSchema } from '../prompts/schemas.js';
import type { Gap, ImplementerOutput } from '../types.js';

export interface ImplementerInput {
  gap: Gap;
  visionMd: string;
  worktreePath: string;
  retryHints: string[];
}

export async function runImplementer(
  q: Queries,
  sessionId: number,
  fixId: number,
  input: ImplementerInput,
): Promise<ImplementerOutput | { error: string }> {
  const result = await runAgent<unknown>(q, {
    role: 'implementer',
    model: 'sonnet',
    sessionId,
    gapId: input.gap.id,
    fixId,
    cwd: input.worktreePath,
    timeoutMs: 600_000,
    promptInputs: {
      worktree_path: input.worktreePath,
      gap_title: input.gap.title,
      gap_slug: input.gap.slug,
      gap_category: input.gap.category,
      gap_body: input.gap.body,
      suggested_approach: input.gap.suggestedApproach,
      expected_files_changed: JSON.stringify(input.gap.expectedFilesChanged),
      vision_md: input.visionMd,
      retry_hints: input.retryHints.length ? input.retryHints.join('\n') : '(no prior attempts)',
    },
    thoughtSummary: `implementer 上手 ${input.gap.slug}`,
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = ImplementerOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  return {
    filesChanged: parsed.data.files_changed,
    commandsRun: parsed.data.commands_run,
    testOutputExcerpt: parsed.data.test_output_excerpt,
    commitSha: parsed.data.commit_sha,
    residualRisks: parsed.data.residual_risks,
    confidence: parsed.data.confidence,
  };
}
