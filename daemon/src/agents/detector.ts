import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { treeDump, readManifests, readReadmeHead } from '../repo-scan/scan.js';
import { DetectorOutputSchema } from '../prompts/schemas.js';
import type { DetectorOutput } from '../types.js';

export async function runDetector(
  q: Queries,
  sessionId: number,
  repoPath: string,
): Promise<DetectorOutput | { error: string }> {
  const [tree, manifests, readme] = await Promise.all([
    treeDump(repoPath, 3),
    readManifests(repoPath),
    readReadmeHead(repoPath, 100),
  ]);

  const result = await runAgent<unknown>(q, {
    role: 'detector',
    model: 'haiku',
    sessionId,
    promptInputs: {
      tree_dump: tree,
      manifests,
      readme_head: readme,
    },
    thoughtSummary: '扫仓库猜项目类型',
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = DetectorOutputSchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  const data = parsed.data;
  return {
    type: data.type as DetectorOutput['type'],
    confidence: data.confidence,
    evidence: data.evidence,
    presetCandidates: data.preset_candidates as DetectorOutput['presetCandidates'],
    inferredCheckCommands: data.inferred_check_commands,
  };
}
