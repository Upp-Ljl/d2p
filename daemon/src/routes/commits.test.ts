/**
 * Tests for GET /api/commits?limit=N
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { runMigrations } from '../storage/migrations/index.js';
import { Queries } from '../storage/queries.js';

function buildApp(q: Queries) {
  const app = new Hono();

  app.get('/api/commits', (c) => {
    const session = q.getCurrentActiveSession() ?? q.getLatestSession();
    if (!session) {
      return c.json({ commits: [] });
    }
    const rawLimit = c.req.query('limit');
    const limit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit, 10) || 50), 200) : 50;
    const commits = q.listMergedCommits(session.id, limit);
    return c.json({ commits });
  });

  return app;
}

function setup() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  const q = new Queries(db);
  return { db, q };
}

describe('GET /api/commits', () => {
  it('returns empty commits when no session', async () => {
    const { q } = setup();
    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/commits'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { commits: unknown[] };
    expect(body.commits).toEqual([]);
  });

  it('returns empty commits when session has no merged fixes', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-commits1' : '/demo-commits1';
    const demo = q.upsertDemo(demoPath);
    q.insertSession(demo.id);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/commits'));
    const body = (await res.json()) as { commits: unknown[] };
    expect(body.commits).toHaveLength(0);
  });

  it('returns one commit for a merged fix', async () => {
    const { q, db } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-commits2' : '/demo-commits2';
    const demo = q.upsertDemo(demoPath);
    const session = q.insertSession(demo.id);
    const gap = q.insertGap({
      sessionId: session.id,
      slug: 'fix-readme',
      title: 'Add README',
      body: 'needs readme',
      category: 'misc',
      severity: 'P2',
      source: 'preset',
      suggestedApproach: '',
      expectedFilesChanged: ['README.md'],
      parentGapId: null,
    });
    q.transitionGap(gap.id, 'IN_PROGRESS');
    const fix = q.insertFix({ gapId: gap.id, attempt: 1, branch: 'fix/readme-1', worktreePath: '/tmp/wt-r' });
    db.prepare(`UPDATE fixes SET status = 'MERGED', commit_sha = 'cafebabe', files_changed = '["README.md"]', finished_at = ? WHERE id = ?`)
      .run(Date.now(), fix.id);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/commits'));
    const body = (await res.json()) as { commits: Array<{ sha: string; gapSlug: string; filesChanged: number }> };
    expect(body.commits).toHaveLength(1);
    expect(body.commits[0]!.sha).toBe('cafebabe');
    expect(body.commits[0]!.gapSlug).toBe('fix-readme');
    expect(body.commits[0]!.filesChanged).toBe(1);
  });

  it('respects the limit query parameter', async () => {
    const { q, db } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-commits3' : '/demo-commits3';
    const demo = q.upsertDemo(demoPath);
    const session = q.insertSession(demo.id);

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
      const fix = q.insertFix({ gapId: gap.id, attempt: 1, branch: `fix/g${i}`, worktreePath: `/tmp/c${i}` });
      db.prepare(`UPDATE fixes SET status = 'MERGED', commit_sha = 'sha${i}', finished_at = ? WHERE id = ?`)
        .run(Date.now() + i, fix.id);
    }

    const app = buildApp(q);
    const res2 = await app.fetch(new Request('http://localhost/api/commits?limit=2'));
    const body2 = (await res2.json()) as { commits: unknown[] };
    expect(body2.commits).toHaveLength(2);
  });
});
