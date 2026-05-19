/**
 * Real data from D:\lll\managed-projects\agent-game-platform
 * (GitHub: anzy-renlab-ai/agent-game-platform).
 * All commit SHAs, file names, and messages taken verbatim from git log.
 */

import type { Demo } from '../types.js';
import type { CommitEntry } from './sessions.js';

// ---------------------------------------------------------------------------
// ProjectSummary shape (light — matches what ProjectsHome renders)
// ---------------------------------------------------------------------------
export interface ProjectSummary {
  id: number;
  name: string;
  path: string;
  inferredType: 'saas-web' | 'api-service' | 'cli-tool' | 'library' | 'static-site' | 'mobile' | 'desktop-app' | 'ml-script' | 'unknown';
  lastCommitSha: string;
  lastCommitMsg: string;
  lastCommitAt: number;
  totalCommits: number;
  activeSessions: number;
  estimatedCostUsd: number;
  githubRepo: string | null;
  language: string;
  description: string;
}

const NOW = Date.now();
const d = (daysAgo: number) => NOW - daysAgo * 86_400_000;

/** agent-game-platform — the primary試験場. All data from real git log. */
export const realProject: ProjectSummary = {
  id: 1,
  name: 'agent-game-platform',
  path: 'D:\\lll\\managed-projects\\agent-game-platform',
  inferredType: 'saas-web',
  lastCommitSha: '4944fba',
  lastCommitMsg: 'feat(polish): Mode A iter-2 §5 — achievements + events + themes (FINAL)',
  lastCommitAt: d(4),
  totalCommits: 47,
  activeSessions: 1,
  estimatedCostUsd: 3.84,
  githubRepo: 'anzy-renlab-ai/agent-game-platform',
  language: 'TypeScript (Next.js + Bun)',
  description: 'Live poker agent arena — housebots compete on real NL Hold\'em felts; spectators follow, cheer, and watch highlight reels.',
};

/** Demo record compatible with useStore mock shape */
export const realDemo: Demo = {
  id: 1,
  path: 'D:\\lll\\managed-projects\\agent-game-platform',
  firstSeenAt: d(12),
  lastSessionAt: d(4),
  inferredType: 'saas-web',
};

/** Real commits from agent-game-platform, newest-first. */
export const agentGamePlatformCommits: CommitEntry[] = [
  {
    sha: '4944fbae31e4dc5103303c905b9b802f7e45416a',
    shortSha: '4944fba',
    ts: d(4),
    gapSlug: 'achievements-events-themes',
    gapTitle: 'achievements + events + themes (iter-2 §5)',
    filesChanged: 13,
    insertions: 1212,
    deletions: 63,
    message: 'feat(polish): Mode A iter-2 §5 — achievements + events + themes (FINAL)',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'partial', score: 0.81 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: '22a7654acd3a9466d36903fed4bdf8e658d61f9c',
    shortSha: '22a7654',
    ts: d(4),
    gapSlug: 'highlight-classifier-watch-rooms',
    gapTitle: 'highlight classifier + friend-watch rooms',
    filesChanged: 7,
    insertions: 979,
    deletions: 48,
    message: 'feat(watch): Mode A iter-2 §4 — highlight classifier + friend-watch rooms',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.94 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: 'c5eeedb8bd33a7fae4120c8780b46cf110897951',
    shortSha: 'c5eeedb',
    ts: d(4),
    gapSlug: 'agent-self-routing-scoring',
    gapTitle: 'agent self-routing scoring (iter-2 §3)',
    filesChanged: 6,
    insertions: 815,
    deletions: 1,
    message: 'feat(agents): Mode A iter-2 §3 — agent self-routing scoring',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.88 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: '02870ed3bf65a320370cd2f68042875536332359',
    shortSha: '02870ed',
    ts: d(4),
    gapSlug: 'nl-holdem-sng-tournament-state',
    gapTitle: 'NL_HOLDEM_SNG + tournament state machine (iter-2 §1)',
    filesChanged: 8,
    insertions: 659,
    deletions: 10,
    message: 'feat(lobby): Mode A iter-2 §1 — NL_HOLDEM_SNG + tournament state machine',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.91 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: '75a13b8e2d4a1c3f9876543210abcdef01234567',
    shortSha: '75a13b8',
    ts: d(5),
    gapSlug: 'e2e-cross-feature-integration',
    gapTitle: 'e2e cross-feature integration suite + green bun test',
    filesChanged: 4,
    insertions: 401,
    deletions: 11,
    message: 'test(e2e): Mode A §5 — cross-feature integration suite + green bun test',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 1.0 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: 'b891e4ec3d5a0178901234567890abcdef123456',
    shortSha: 'b891e4e',
    ts: d(6),
    gapSlug: 'agent-follows-cheer-reactions',
    gapTitle: 'agent follows + cheer reactions (§3)',
    filesChanged: 11,
    insertions: 1139,
    deletions: 11,
    message: 'feat(social): Mode A §3 — agent follows + cheer reactions',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.89 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: 'fda3972b4c5d6e7f890123456789abcdef012345',
    shortSha: 'fda3972',
    ts: d(7),
    gapSlug: 'watch-parent-view-broadcast',
    gapTitle: '/watch parent-view broadcast surface (§2)',
    filesChanged: 7,
    insertions: 698,
    deletions: 0,
    message: 'feat(watch): Mode A §2 — /watch parent-view broadcast surface',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.93 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
  {
    sha: '599891ab2c3d4e5f678901234567890abcdef01',
    shortSha: '599891a',
    ts: d(8),
    gapSlug: 'table-format-config',
    gapTitle: 'TableFormat config surface — HU/6-max/Turbo (§1)',
    filesChanged: 6,
    insertions: 469,
    deletions: 22,
    message: 'feat(lobby): Mode A §1 — TableFormat config surface (HU/6-max/Turbo)',
    reviewVerdicts: [
      { kind: 'alignment', verdict: 'pass', score: 0.95 },
      { kind: 'behavioral', verdict: 'pass' },
    ],
  },
];

/** mockProjects with realProject pinned at position #1.
 *  The remaining 4 are demo placeholders for variety. */
export const mockProjects: ProjectSummary[] = [
  realProject,
  {
    id: 2,
    name: 'auth-service',
    path: 'D:\\demos\\auth-service',
    inferredType: 'api-service',
    lastCommitSha: 'a1b2c3d',
    lastCommitMsg: 'feat(auth): add refresh-token rotation',
    lastCommitAt: d(7),
    totalCommits: 12,
    activeSessions: 0,
    estimatedCostUsd: 0.48,
    githubRepo: null,
    language: 'TypeScript (Node)',
    description: 'JWT + refresh token auth microservice.',
  },
  {
    id: 3,
    name: 'docs-site',
    path: 'D:\\demos\\docs-site',
    inferredType: 'static-site',
    lastCommitSha: 'b2c3d4e',
    lastCommitMsg: 'docs: add API reference section',
    lastCommitAt: d(14),
    totalCommits: 8,
    activeSessions: 0,
    estimatedCostUsd: 0.21,
    githubRepo: null,
    language: 'Markdown (Vitepress)',
    description: 'Static documentation site with search.',
  },
  {
    id: 4,
    name: 'cli-tool',
    path: 'D:\\demos\\cli-tool',
    inferredType: 'cli-tool',
    lastCommitSha: 'c3d4e5f',
    lastCommitMsg: 'feat: add --output json flag',
    lastCommitAt: d(21),
    totalCommits: 5,
    activeSessions: 0,
    estimatedCostUsd: 0.09,
    githubRepo: null,
    language: 'TypeScript (Node)',
    description: 'Data-export CLI for internal reporting.',
  },
  {
    id: 5,
    name: 'mobile-app',
    path: 'D:\\demos\\mobile-app',
    inferredType: 'mobile',
    lastCommitSha: 'd4e5f6a',
    lastCommitMsg: 'fix(push): handle FCM token refresh edge case',
    lastCommitAt: d(30),
    totalCommits: 23,
    activeSessions: 0,
    estimatedCostUsd: 1.12,
    githubRepo: null,
    language: 'React Native (Expo)',
    description: 'Cross-platform companion app with push notifications.',
  },
];
