import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../storage/migrations/index.js';
import { Queries } from '../storage/queries.js';
import { runAdversarial } from './reviewers.js';
import type { Gap } from '../types.js';

let db: Database.Database;
let q: Queries;
let prevEnv: string | undefined;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  q = new Queries(db);
  prevEnv = process.env.ZEROU_ADVERSARIAL_FIXTURE;
  process.env.ZEROU_ADVERSARIAL_FIXTURE = '1';
});

afterEach(() => {
  if (prevEnv === undefined) delete process.env.ZEROU_ADVERSARIAL_FIXTURE;
  else process.env.ZEROU_ADVERSARIAL_FIXTURE = prevEnv;
  db.close();
});

function makeFix(attempt: number, category: Gap['category'] = 'auth'): { fixId: number; gap: Gap } {
  const demoPath = process.platform === 'win32' ? 'D:\\demo-adv' : '/demo-adv';
  const demo = q.upsertDemo(demoPath);
  const session = q.insertSession(demo.id);
  const gap = q.insertGap({
    sessionId: session.id,
    slug: 'auth-something',
    title: 'auth issue',
    body: 'fix the auth',
    category,
    severity: 'P1',
    source: 'preset',
    suggestedApproach: '',
    expectedFilesChanged: [],
    parentGapId: null,
  });
  // Seed prior attempts so getFix() returns the requested attempt number.
  for (let i = 1; i <= attempt; i++) {
    q.insertFix({
      gapId: gap.id,
      attempt: i,
      branch: `fix/auth-something`,
      worktreePath: '/tmp/wt',
    });
  }
  const fix = q.getFix(
    (db.prepare('SELECT id FROM fixes ORDER BY id DESC LIMIT 1').get() as { id: number }).id,
  )!;
  return { fixId: fix.id, gap };
}

describe('runAdversarial — fixture mode (ZEROU_ADVERSARIAL_FIXTURE=1)', () => {
  it('attempt 1 returns BREAK with category-appropriate vector', async () => {
    const { fixId, gap } = makeFix(1, 'auth');
    const res = await runAdversarial(q, gap.sessionId, fixId, gap, 'diff snippet', 'static gate out');
    if ('error' in res) throw new Error(`unexpected error: ${res.error}`);
    expect(res.anyBreak).toBe(true);
    expect(res.attempts).toHaveLength(1);
    expect(res.attempts[0].broke).toBe(true);
    expect(res.attempts[0].vector).toBe('session-fixation');
  });

  it('attempt 2+ returns PASS so retry can succeed', async () => {
    const { fixId, gap } = makeFix(2, 'auth');
    const res = await runAdversarial(q, gap.sessionId, fixId, gap, 'diff snippet', 'static gate out');
    if ('error' in res) throw new Error(`unexpected error: ${res.error}`);
    expect(res.anyBreak).toBe(false);
    expect(res.attempts[0].broke).toBe(false);
  });

  it('uses input-validation attack vector for sql category', async () => {
    const { fixId, gap } = makeFix(1, 'input-validation');
    const res = await runAdversarial(q, gap.sessionId, fixId, gap, '', '');
    if ('error' in res) throw new Error(res.error);
    expect(res.attempts[0].vector).toBe('SQL-injection-via-array');
  });
});
