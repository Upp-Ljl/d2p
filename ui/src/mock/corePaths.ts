/**
 * Core paths for agent-game-platform.
 * User-pinned: globs the user explicitly marked as "must-review".
 * AI-inferred: globs derived from import frequency analysis (high fan-in modules).
 *
 * Real files pulled from:
 *   git -C D:/lll/managed-projects/agent-game-platform ls-tree -r --name-only HEAD
 */

export type CorePathSource = 'user' | 'inferred';

export interface CorePath {
  glob: string;
  source: CorePathSource;
  label: string;        // human-readable purpose
  hitCount?: number;    // for inferred: how many files import this
}

/** User-pinned paths (set explicitly in .d2p/core-paths.yaml) */
export const userPinnedPaths: CorePath[] = [
  { glob: 'app/api/auth/**',   source: 'user',     label: 'Auth API routes — any change here needs security review' },
  { glob: 'lib/db/**',         source: 'user',     label: 'DB layer — schema + query helpers, high blast radius' },
  { glob: 'bunfig.toml',       source: 'user',     label: 'Bun runtime config — affects all build + test behavior' },
  { glob: 'Dockerfile',        source: 'user',     label: 'Container image — changes affect prod deployment shape' },
  { glob: 'lib/payments/**',   source: 'user',     label: 'Payment logic — no accidental mutation allowed' },
  { glob: 'prompts/**',        source: 'user',     label: 'LLM prompt templates — AI behavior changes on any edit' },
];

/** AI-inferred paths (high import-count modules detected by static analysis) */
export const inferredPaths: CorePath[] = [
  { glob: 'lib/lobby-tables.ts', source: 'inferred', label: 'LobbyTable types + FELTS constant — imported by 9 modules', hitCount: 9 },
  { glob: 'lib/agents/**',       source: 'inferred', label: 'Agent persona catalog + routing — 7 import sites',          hitCount: 7 },
  { glob: 'lib/themes.ts',       source: 'inferred', label: 'Theme CSS vars — 6 components read these at runtime',       hitCount: 6 },
  { glob: 'app/api/stream/**',   source: 'inferred', label: 'SSE stream routes — real-time data fan-out to all clients', hitCount: 4 },
];

/** All core paths combined */
export const allCorePaths: CorePath[] = [...userPinnedPaths, ...inferredPaths];

/** A sample commit hit — for CorePathsAlert demo mode */
export interface CorePathHit {
  changedPath: string;       // file that changed
  matchedGlob: string;       // which core-path glob it matched
  insertions: number;
  deletions: number;
  diffPreview: string[];     // first ~5 lines of the largest hunk
}

export const sampleCorePathHits: CorePathHit[] = [
  {
    changedPath: 'lib/themes.ts',
    matchedGlob: 'lib/themes.ts',
    insertions: 108,
    deletions: 0,
    diffPreview: [
      '+export type Theme = "default" | "light" | "midnight";',
      '+',
      '+export const THEME_VARS: Record<Theme, Readonly<Record<string, string>>> = {',
      '+  default: { "--arena-bg": "#0B0D10", "--arena-fg": "#E8EAED" },',
      '+  light:   { "--arena-bg": "#F4F5F7", "--arena-fg": "#15171B" },',
    ],
  },
  {
    changedPath: 'lib/agent-routing.ts',
    matchedGlob: 'lib/agents/**',
    insertions: 296,
    deletions: 0,
    diffPreview: [
      '+export function scoreTableForAgent(agent: AgentPersona, table: LobbyTable): number {',
      '+  let score = 30; // baseline',
      '+  const prefIdx = agent.preferredFormats?.indexOf(table.format) ?? -1;',
      '+  if (prefIdx >= 0) score += FORMAT_BONUS_BY_RANK[prefIdx] ?? 0;',
      '+  for (const rule of STYLE_RULES) {',
    ],
  },
];
