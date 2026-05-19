/**
 * Canned AI risk scores for agent-game-platform commits.
 * Bands follow daemon spec: 'low' | 'mid' | 'high'.
 * reviewHunks point to specific paths + hunkIdx that a human should spot-check.
 */

export type RiskBand = 'low' | 'mid' | 'high';

export interface ReviewHunk {
  path: string;
  hunkIdx: number;
  reason: string;
}

export interface CommitRisk {
  sha: string;
  band: RiskBand;
  score: number;         // 0.0 – 1.0
  reasons: string[];
  reviewHunks: ReviewHunk[];
}

/** Risk scores per trial commit sha (both short and full forms mapped). */
export const mockRiskByCommitSha: Record<string, CommitRisk> = {
  // 4944fba: achievements + events + themes — MID
  // Touches lib/themes.ts which is a widely-imported module; no test for
  // the events-fire-on-schedule path; localStorage mutation.
  '4944fba': {
    sha: '4944fba',
    band: 'mid',
    score: 0.55,
    reasons: [
      'lib/themes.ts is imported by 7 components — a breaking type change would be silent',
      'LobbyEventStrip timer path (setInterval) has no test coverage',
      'localStorage writes in lib/achievements.ts not covered by integration test',
    ],
    reviewHunks: [
      { path: 'lib/themes.ts',              hunkIdx: 0, reason: 'THEME_VARS keys must stay stable — downstream CSS depends on exact var names' },
      { path: 'components/LobbyEventStrip.tsx', hunkIdx: 0, reason: 'setInterval not cleared on HMR reload — potential double-tick in dev' },
    ],
  },
  '4944fbae31e4dc5103303c905b9b802f7e45416a': {
    sha: '4944fbae31e4dc5103303c905b9b802f7e45416a',
    band: 'mid',
    score: 0.55,
    reasons: [
      'lib/themes.ts is imported by 7 components — a breaking type change would be silent',
      'LobbyEventStrip timer path (setInterval) has no test coverage',
      'localStorage writes in lib/achievements.ts not covered by integration test',
    ],
    reviewHunks: [
      { path: 'lib/themes.ts',              hunkIdx: 0, reason: 'THEME_VARS keys must stay stable — downstream CSS depends on exact var names' },
      { path: 'components/LobbyEventStrip.tsx', hunkIdx: 0, reason: 'setInterval not cleared on HMR reload — potential double-tick in dev' },
    ],
  },

  // 22a7654: highlight classifier + friend-watch rooms — LOW
  // Test included (29 + 18 cases); pure functions with no I/O; isolated module.
  '22a7654': {
    sha: '22a7654',
    band: 'low',
    score: 0.18,
    reasons: [
      'New pure module — no shared state, no DB writes',
      '47 tests ship alongside, covering happy path + edge cases',
    ],
    reviewHunks: [],
  },
  '22a7654acd3a9466d36903fed4bdf8e658d61f9c': {
    sha: '22a7654acd3a9466d36903fed4bdf8e658d61f9c',
    band: 'low',
    score: 0.18,
    reasons: [
      'New pure module — no shared state, no DB writes',
      '47 tests ship alongside, covering happy path + edge cases',
    ],
    reviewHunks: [],
  },

  // c5eeedb: agent self-routing scoring — HIGH
  // Touches core scoring logic (scoreTableForAgent) + no integration test
  // verifying housebot placement at runtime. lib/agent-routing.ts imported
  // by /agents/[id]/page.tsx which renders in production.
  'c5eeedb': {
    sha: 'c5eeedb',
    band: 'high',
    score: 0.78,
    reasons: [
      'scoreTableForAgent is now used in prod page /agents/[id] — logic errors directly visible to users',
      'No integration test verifies housebot placement end-to-end (unit tests only)',
      'FORMAT_BONUS_BY_RANK array is undocumented magic numbers — easy to mis-tune',
      'explainScore string output is not tested for stability across refactors',
    ],
    reviewHunks: [
      { path: 'lib/agent-routing.ts',        hunkIdx: 0, reason: 'FORMAT_BONUS_BY_RANK: [50,30,18,10] — document the tuning rationale or add an assertion' },
      { path: 'lib/agent-routing.ts',        hunkIdx: 1, reason: 'STYLE_RULES: maniac+turbo synergy — confirm the 12-point bonus is intentional vs 10 for calling station' },
      { path: 'app/agents/[id]/page.tsx',    hunkIdx: 0, reason: 'New "Where this agent leans" section renders explainScore — verify layout on narrow viewports' },
    ],
  },
  'c5eeedb8bd33a7fae4120c8780b46cf110897951': {
    sha: 'c5eeedb8bd33a7fae4120c8780b46cf110897951',
    band: 'high',
    score: 0.78,
    reasons: [
      'scoreTableForAgent is now used in prod page /agents/[id] — logic errors directly visible to users',
      'No integration test verifies housebot placement end-to-end (unit tests only)',
      'FORMAT_BONUS_BY_RANK array is undocumented magic numbers — easy to mis-tune',
    ],
    reviewHunks: [
      { path: 'lib/agent-routing.ts',     hunkIdx: 0, reason: 'FORMAT_BONUS_BY_RANK: [50,30,18,10] — document the tuning rationale or add an assertion' },
      { path: 'lib/agent-routing.ts',     hunkIdx: 1, reason: 'STYLE_RULES: maniac+turbo synergy — confirm the 12-point bonus is intentional' },
      { path: 'app/agents/[id]/page.tsx', hunkIdx: 0, reason: 'New "Where this agent leans" section — verify layout on narrow viewports' },
    ],
  },

  // 02870ed: NL_HOLDEM_SNG + tournament state machine — MID
  // State machine touch; no engine wiring but schema change to LobbyTable
  // (new `tournament` field) could break existing serialization.
  '02870ed': {
    sha: '02870ed',
    band: 'mid',
    score: 0.52,
    reasons: [
      'lib/lobby-tables.ts: new `tournament` required field — any deserialization of old LobbyTable JSON will silently miss it',
      'lib/tournament-state.ts: state-machine transitions are pure but recordBust is not atomic — concurrent calls untested',
    ],
    reviewHunks: [
      { path: 'lib/lobby-tables.ts',        hunkIdx: 0, reason: '`tournament: TournamentConfig` required on SNG rows — confirm existing fixtures handle missing field gracefully' },
      { path: 'lib/tournament-state.ts',    hunkIdx: 1, reason: 'recordBust does not guard against duplicate agentId — add dedup check' },
    ],
  },
  '02870ed3bf65a320370cd2f68042875536332359': {
    sha: '02870ed3bf65a320370cd2f68042875536332359',
    band: 'mid',
    score: 0.52,
    reasons: [
      'lib/lobby-tables.ts: new `tournament` required field — any deserialization of old LobbyTable JSON will silently miss it',
      'lib/tournament-state.ts: state-machine transitions are pure but recordBust is not atomic — concurrent calls untested',
    ],
    reviewHunks: [
      { path: 'lib/lobby-tables.ts',     hunkIdx: 0, reason: '`tournament: TournamentConfig` required on SNG rows — confirm existing fixtures handle missing field gracefully' },
      { path: 'lib/tournament-state.ts', hunkIdx: 1, reason: 'recordBust does not guard against duplicate agentId — add dedup check' },
    ],
  },
};
