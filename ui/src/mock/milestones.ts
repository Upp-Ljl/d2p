/**
 * Vision milestones derived from agent-game-platform commits and README/vision.
 * 6 milestones: Lobby → Watch → Social → Agents → Polish → Ship
 *
 * vision_excerpt lines are paraphrased from the project's commit messages and
 * CLAUDE.md intent (the project's CAIRN.md scaffold is sparse/unfilled).
 */

export type MilestoneStatus = 'done' | 'in-progress' | 'pending';

export interface Milestone {
  id: string;
  ordinal: number;
  title: string;
  subtitle: string;
  vision_excerpt: string;
  presetItemIds: string[];   // refs from mockPresetItemsRich
  status: MilestoneStatus;
  completedAt: number | null;
  doneCount: number;
  totalCount: number;
}

const NOW = Date.now();
const d = (daysAgo: number) => NOW - daysAgo * 86_400_000;

export const mockMilestones: Milestone[] = [
  {
    id: 'M1-lobby',
    ordinal: 1,
    title: 'Lobby',
    subtitle: 'NL Hold\'em table formats + SNG felt',
    vision_excerpt: 'feat(lobby): Mode A iter-2 §1 — NL_HOLDEM_SNG + tournament state machine. Iteration 2 of the Mode A plan reaches step 1: the lobby gets its first tournament-shape felt and a typed state machine ready for engine integration.',
    presetItemIds: ['build-typecheck', 'build-reproducible', 'test-runner-present', 'test-happy-path-passes', 'lockfile-present'],
    status: 'done',
    completedAt: d(8),
    doneCount: 5,
    totalCount: 5,
  },
  {
    id: 'M2-watch',
    ordinal: 2,
    title: 'Watch',
    subtitle: 'Parent-view broadcast + friend rooms',
    vision_excerpt: 'feat(watch): Mode A §2 — /watch parent-view broadcast surface. Hands now classify themselves into a closed HighlightKind union so a future reel can show curated drama, and a friend-watch "room id" lets two spectators share a URL and see they\'re watching together.',
    presetItemIds: ['readme-quickstart', 'env-example', 'no-hardcoded-secrets', 'port-from-env'],
    status: 'done',
    completedAt: d(4),
    doneCount: 4,
    totalCount: 4,
  },
  {
    id: 'M3-social',
    ordinal: 3,
    title: 'Social',
    subtitle: 'Agent follows + cheer reactions',
    vision_excerpt: 'feat(social): Mode A §3 — agent follows + cheer reactions. Returning spectators now follow housebots and fire cheer reactions in real time, building a social graph that makes spectating feel personal.',
    presetItemIds: ['auth-on-mutating-routes', 'password-hash-strong', 'https-only-prod', 'rate-limit-public', 'sql-parameterized', 'cors-not-wildcard'],
    status: 'done',
    completedAt: d(6),
    doneCount: 5,
    totalCount: 6,
  },
  {
    id: 'M4-agents',
    ordinal: 4,
    title: 'Agents',
    subtitle: 'Persona profiles + self-routing scoring',
    vision_excerpt: 'feat(agents): Mode A iter-2 §3 — agent self-routing scoring. Agents now have an opinion about which felt suits them, derived from a closed PlayStyleTag set plus a new editorial preferredFormats field on each persona. scoreTableForAgent returns 0..100 with a baseline + format-match bonus + style-rule synergies.',
    presetItemIds: ['test-edge-cases', 'sigterm-handler', 'stdout-logging', 'error-handler-present', 'structured-logs'],
    status: 'done',
    completedAt: d(4),
    doneCount: 3,
    totalCount: 5,
  },
  {
    id: 'M5-polish',
    ordinal: 5,
    title: 'Polish',
    subtitle: 'Achievements + events + theme toggle',
    vision_excerpt: 'feat(polish): Mode A iter-2 §5 — achievements + events + themes (FINAL). Returning spectators now see signals they haven\'t before: the site remembers what they\'ve done (achievements), it has rhythms (events), and they can change how it looks (themes).',
    presetItemIds: ['health-endpoint', 'a11y-axe-clean', 'viewport-meta', 'error-boundary', 'ci-pipeline', 'ci-token-perms'],
    status: 'in-progress',
    completedAt: null,
    doneCount: 1,
    totalCount: 6,
  },
  {
    id: 'M6-ship',
    ordinal: 6,
    title: 'Ship',
    subtitle: 'Deploy config + docs + CI green',
    vision_excerpt: 'Ship the arena to arean.renlab.ai with a production Vercel deployment, full CI pipeline, documented API, and spectator onboarding guide. The product becomes "done" when a new spectator can land, follow an agent, watch a hand replay, and earn their first achievement without any friction.',
    presetItemIds: ['deploy-config', 'package-publishable', 'binary-not-committed', 'vision-verdict'],
    status: 'pending',
    completedAt: null,
    doneCount: 1,
    totalCount: 4,
  },
];

/** Overall milestone KPI */
export function getMilestoneKpi(milestones: Milestone[]): { done: number; total: number; pct: number } {
  const done = milestones.filter((m) => m.status === 'done').length;
  const total = milestones.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
