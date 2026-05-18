import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations/index.js';
import { Queries } from './queries.js';

function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  const q = new Queries(db);
  const demoPath = process.platform === 'win32' ? 'D:\\demo-agg' : '/demo-agg';
  const demo = q.upsertDemo(demoPath);
  const session = q.insertSession(demo.id);
  return { db, q, session };
}

// ─── aggregateSessionsByRole ──────────────────────────────────────────────────

describe('Queries: aggregateSessionsByRole', () => {
  it('returns all 7 role rows with idle status when no events', () => {
    const { q, session } = setup();
    const rows = q.aggregateSessionsByRole(session.id);
    expect(rows).toHaveLength(7);
    const roles = rows.map((r) => r.role);
    expect(roles).toContain('differ');
    expect(roles).toContain('implementer');
    expect(roles).toContain('alignment');
    expect(roles).toContain('behavioral');
    expect(roles).toContain('adversarial');
    expect(roles).toContain('done-check');
    expect(roles).toContain('repo-summary');
    for (const row of rows) {
      expect(row.status).toBe('idle');
      expect(row.callsThisSession).toBe(0);
      expect(row.lastActivityTs).toBeNull();
    }
  });

  it('marks role as working after AGENT_START', () => {
    const { q, session } = setup();
    q.insertLogEvent(session.id, 'info', 'AGENT_START', {
      role: 'implementer',
      gapSlug: 'fix-auth',
      thought: 'writing auth middleware',
    });
    const rows = q.aggregateSessionsByRole(session.id);
    const impl = rows.find((r) => r.role === 'implementer')!;
    expect(impl.status).toBe('working');
    expect(impl.callsThisSession).toBe(1);
    expect(impl.currentGapSlug).toBe('fix-auth');
    expect(impl.lastTurnSummary).toBe('writing auth middleware');
    expect(impl.lastActivityTs).toBeGreaterThan(0);
  });

  it('marks role as idle after AGENT_END', () => {
    const { q, session } = setup();
    q.insertLogEvent(session.id, 'info', 'AGENT_START', { role: 'differ', thought: 'scanning' });
    q.insertLogEvent(session.id, 'info', 'AGENT_END', { role: 'differ' });
    const rows = q.aggregateSessionsByRole(session.id);
    const differ = rows.find((r) => r.role === 'differ')!;
    expect(differ.status).toBe('idle');
    expect(differ.callsThisSession).toBe(1);
  });

  it('counts AGENT_START calls across multiple gaps', () => {
    const { q, session } = setup();
    q.insertLogEvent(session.id, 'info', 'AGENT_START', { role: 'implementer', gapSlug: 'gap-a' });
    q.insertLogEvent(session.id, 'info', 'AGENT_END', { role: 'implementer' });
    q.insertLogEvent(session.id, 'info', 'AGENT_START', { role: 'implementer', gapSlug: 'gap-b' });
    const rows = q.aggregateSessionsByRole(session.id);
    const impl = rows.find((r) => r.role === 'implementer')!;
    expect(impl.callsThisSession).toBe(2);
    expect(impl.currentGapSlug).toBe('gap-b');
  });
});

// ─── listMergedCommits ────────────────────────────────────────────────────────

describe('Queries: listMergedCommits', () => {
  it('returns empty array when no merged fixes exist', () => {
    const { q, session } = setup();
    expect(q.listMergedCommits(session.id)).toEqual([]);
  });

  it('returns one row for a merged fix with correct shape', () => {
    const { q, session } = setup();
    // Insert a gap
    const gap = q.insertGap({
      sessionId: session.id,
      slug: 'fix-license',
      title: 'Add MIT LICENSE',
      body: 'No license file',
      category: 'misc',
      severity: 'P3',
      source: 'preset',
      suggestedApproach: '',
      expectedFilesChanged: ['LICENSE'],
      parentGapId: null,
    });
    q.transitionGap(gap.id, 'IN_PROGRESS');
    // Insert a fix
    const fix = q.insertFix({ gapId: gap.id, attempt: 1, branch: 'fix/license-1', worktreePath: '/tmp/wt' });
    q.transitionFix(fix.id, 'IMPLEMENTING');
    q.transitionFix(fix.id, 'STATIC_GATE_RUNNING');
    q.transitionFix(fix.id, 'STATIC_GATE_FAILED');
    // Can't go directly to MERGED from here, let's use a simpler path
    // Reset: insert a fresh fix at MERGED status via SQL directly
    const db = (q as unknown as { db: Database.Database }).db;
    db.prepare(`UPDATE fixes SET status = 'MERGED', commit_sha = 'abc123def', files_changed = '["LICENSE"]', finished_at = ? WHERE id = ?`)
      .run(Date.now(), fix.id);

    const commits = q.listMergedCommits(session.id);
    expect(commits).toHaveLength(1);
    const c = commits[0]!;
    expect(c.sha).toBe('abc123def');
    expect(c.shortSha).toBe('abc123de');
    expect(c.gapSlug).toBe('fix-license');
    expect(c.gapTitle).toBe('Add MIT LICENSE');
    expect(c.filesChanged).toBe(1);
    expect(c.insertions).toBe(0);
    expect(c.deletions).toBe(0);
    expect(c.message).toBe('Add MIT LICENSE');
    expect(Array.isArray(c.reviewVerdicts)).toBe(true);
  });

  it('includes review verdicts when reviews exist', () => {
    const { q, session } = setup();
    const gap = q.insertGap({
      sessionId: session.id,
      slug: 'fix-auth',
      title: 'Add auth',
      body: 'auth needed',
      category: 'auth',
      severity: 'P1',
      source: 'preset',
      suggestedApproach: '',
      expectedFilesChanged: [],
      parentGapId: null,
    });
    q.transitionGap(gap.id, 'IN_PROGRESS');
    const fix = q.insertFix({ gapId: gap.id, attempt: 1, branch: 'fix/auth-1', worktreePath: '/tmp/wt2' });
    const db = (q as unknown as { db: Database.Database }).db;
    db.prepare(`UPDATE fixes SET status = 'MERGED', commit_sha = 'deadbeef', finished_at = ? WHERE id = ?`)
      .run(Date.now(), fix.id);
    // Insert review
    q.insertReview({
      fixId: fix.id,
      kind: 'alignment',
      model: 'haiku',
      verdict: 'APPROVE',
      hints: [],
      reasonCode: 'OK',
      difficulty: 90,
      splitInto: null,
      rawJson: '{}',
    });

    const commits = q.listMergedCommits(session.id);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.reviewVerdicts).toHaveLength(1);
    expect(commits[0]!.reviewVerdicts[0]!.kind).toBe('alignment');
    expect(commits[0]!.reviewVerdicts[0]!.verdict).toBe('APPROVE');
    expect(commits[0]!.reviewVerdicts[0]!.score).toBe(90);
  });

  it('respects limit parameter', () => {
    const { q, session } = setup();
    const db = (q as unknown as { db: Database.Database }).db;
    // Insert 5 gaps + merged fixes
    for (let i = 0; i < 5; i++) {
      const gap = q.insertGap({
        sessionId: session.id,
        slug: `gap-${i}`,
        title: `Gap ${i}`,
        body: '',
        category: 'misc',
        severity: 'P3',
        source: 'preset',
        suggestedApproach: '',
        expectedFilesChanged: [],
        parentGapId: null,
      });
      q.transitionGap(gap.id, 'IN_PROGRESS');
      const fix = q.insertFix({ gapId: gap.id, attempt: 1, branch: `fix/g${i}`, worktreePath: `/tmp/w${i}` });
      db.prepare(`UPDATE fixes SET status = 'MERGED', commit_sha = 'sha${i}', finished_at = ? WHERE id = ?`)
        .run(Date.now() + i, fix.id);
    }
    const all = q.listMergedCommits(session.id, 200);
    expect(all).toHaveLength(5);
    const limited = q.listMergedCommits(session.id, 3);
    expect(limited).toHaveLength(3);
  });
});

// ─── listPresetRich ───────────────────────────────────────────────────────────

describe('Queries: listPresetRich', () => {
  it('returns 32 items when no preset_status_history exists', () => {
    const { q, session } = setup();
    const items = q.listPresetRich(session.id);
    expect(items).toHaveLength(32);
    for (const item of items) {
      expect(item.status).toBe('missing');
      expect(typeof item.id).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(['P1', 'P2', 'P3']).toContain(item.severity);
      expect(Array.isArray(item.appliesTo)).toBe(true);
    }
  });

  it('merges known preset status ids into the 32 items', () => {
    const { q, session } = setup();
    q.setPresetStatus(session.id, [
      { item: 'build-typecheck', status: 'done', note: 'tsc ok' },
      { item: 'license-file', status: 'done', note: 'MIT' },
      { item: 'sigterm-handler', status: 'missing', note: null },
    ]);
    const items = q.listPresetRich(session.id);
    expect(items).toHaveLength(32);
    const typecheck = items.find((i) => i.id === 'build-typecheck')!;
    expect(typecheck.status).toBe('done');
    expect(typecheck.note).toBe('tsc ok');
    const license = items.find((i) => i.id === 'license-file')!;
    expect(license.status).toBe('done');
    const sigterm = items.find((i) => i.id === 'sigterm-handler')!;
    expect(sigterm.status).toBe('missing');
  });

  it('preserves meta fields (mechanism, source, appliesTo) from PRESET_META_32', () => {
    const { q, session } = setup();
    const items = q.listPresetRich(session.id);
    const noHardcoded = items.find((i) => i.id === 'no-hardcoded-secrets')!;
    expect(noHardcoded.mechanism).toBe('static-grep');
    expect(noHardcoded.source).toBe('OWASP-A02:2025');
    expect(noHardcoded.appliesTo).toContain('W');
    expect(noHardcoded.appliesTo).toContain('ML');
    const visionVerdict = items.find((i) => i.id === 'vision-verdict')!;
    expect(visionVerdict.mechanism).toBe('llm-judgment');
    expect(visionVerdict.source).toBe('d2p-native');
  });

  it('partial status propagates correctly', () => {
    const { q, session } = setup();
    q.setPresetStatus(session.id, [
      { item: 'test-edge-cases', status: 'partial', note: 'login flow only' },
    ]);
    const items = q.listPresetRich(session.id);
    const edge = items.find((i) => i.id === 'test-edge-cases')!;
    expect(edge.status).toBe('partial');
    expect(edge.note).toBe('login flow only');
  });
});
