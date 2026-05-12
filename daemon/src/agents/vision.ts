import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { treeDump } from '../repo-scan/scan.js';
import { VisionRoundOutputSchema } from '../prompts/schemas.js';
import type { VisionRoundOutput } from '../types.js';

export async function runVisionRound(
  q: Queries,
  sessionId: number,
  repoPath: string,
  detectedType: string,
  drafts: Array<{ question: string; answer: string }>,
  roundIndex: number,
): Promise<VisionRoundOutput | { error: string }> {
  const tree = await treeDump(repoPath, 2);

  const result = await runAgent<unknown>(q, {
    role: 'vision',
    model: 'haiku',
    sessionId,
    promptInputs: {
      detected_type: detectedType,
      tree_short: tree,
      drafts_so_far: JSON.stringify(drafts),
      round_index: String(roundIndex),
    },
    thoughtSummary: `vision elicit round ${roundIndex}`,
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = VisionRoundOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };

  if (parsed.data.done) {
    return { done: true, visionMd: parsed.data.vision_md };
  }
  return { done: false, questions: parsed.data.questions };
}
