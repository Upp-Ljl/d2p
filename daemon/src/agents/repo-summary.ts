import { runAgent } from './runner.js';
import { Queries } from '../storage/queries.js';
import { treeDump, readManifests, readReadmeHead } from '../repo-scan/scan.js';
import { RepoSummarySchema } from '../prompts/schemas.js';
import type { RepoSummary } from '../types.js';

export async function runRepoSummary(
  q: Queries,
  sessionId: number,
  repoPath: string,
): Promise<RepoSummary | { error: string }> {
  const [tree, manifests, readme] = await Promise.all([
    treeDump(repoPath, 4),
    readManifests(repoPath),
    readReadmeHead(repoPath, 60),
  ]);

  const fileHeads = `${manifests}\n\n<file:README>\n${readme}\n</file>`;

  const result = await runAgent<unknown>(q, {
    role: 'repo-summary',
    model: 'haiku',
    sessionId,
    promptInputs: {
      tree_dump: tree,
      file_heads: fileHeads,
    },
    thoughtSummary: '生成 repo 摘要',
  });

  if (!result.ok) return { error: `${result.code}: ${result.message}` };
  const parsed = RepoSummarySchema.safeParse(result.json);
  if (!parsed.success) return { error: `schema: ${parsed.error.message}` };
  const d = parsed.data;
  return {
    entryPoints: d.entry_points,
    frameworks: d.frameworks,
    testPresent: d.test_present,
    authPresent: d.auth_present,
    dbPresent: d.db_present,
    deployConfigPresent: d.deploy_config_present,
    ciPresent: d.ci_present,
    licensePresent: d.license_present,
    readmeQuality: d.readme_quality,
    notableDeps: d.notable_deps,
  };
}

export function repoSummaryToText(s: RepoSummary): string {
  return [
    `entry_points: ${s.entryPoints.join(', ')}`,
    `frameworks: ${s.frameworks.join(', ')}`,
    `test_present: ${s.testPresent}`,
    `auth_present: ${s.authPresent}`,
    `db_present: ${s.dbPresent}`,
    `deploy_config_present: ${s.deployConfigPresent}`,
    `ci_present: ${s.ciPresent}`,
    `license_present: ${s.licensePresent}`,
    `readme_quality: ${s.readmeQuality}`,
    `notable_deps: ${s.notableDeps.join(', ')}`,
  ].join('\n');
}
