/**
 * Tests for GET /api/preset/rich
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { runMigrations } from '../storage/migrations/index.js';
import { Queries } from '../storage/queries.js';
import type { PresetRichRow } from '../types.js';

function buildApp(q: Queries) {
  const app = new Hono();

  app.get('/api/preset/rich', (c) => {
    const session = q.getCurrentActiveSession() ?? q.getLatestSession();
    if (!session) {
      return c.json({ items: [], total: 0, done: 0, partial: 0, missing: 0 });
    }
    const items = q.listPresetRich(session.id);
    const done = items.filter((i) => i.status === 'done').length;
    const partial = items.filter((i) => i.status === 'partial').length;
    const missing = items.filter((i) => i.status === 'missing').length;
    return c.json({ items, total: items.length, done, partial, missing });
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

describe('GET /api/preset/rich', () => {
  it('returns zero counts when no session exists', async () => {
    const { q } = setup();
    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/preset/rich'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; done: number };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.done).toBe(0);
  });

  it('returns 32 items all missing when session has no preset history', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-pr1' : '/demo-pr1';
    const demo = q.upsertDemo(demoPath);
    q.insertSession(demo.id);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/preset/rich'));
    const body = (await res.json()) as { items: PresetRichRow[]; total: number; missing: number };
    expect(body.total).toBe(32);
    expect(body.missing).toBe(32);
    expect(body.items[0]).toMatchObject({
      id: expect.any(String) as unknown as string,
      label: expect.any(String) as unknown as string,
      severity: expect.stringMatching(/^P[123]$/) as unknown as string,
      status: 'missing',
    });
  });

  it('correctly computes done/partial/missing counts', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-pr2' : '/demo-pr2';
    const demo = q.upsertDemo(demoPath);
    const session = q.insertSession(demo.id);
    q.setPresetStatus(session.id, [
      { item: 'build-typecheck', status: 'done', note: null },
      { item: 'build-reproducible', status: 'done', note: null },
      { item: 'test-edge-cases', status: 'partial', note: 'only login' },
    ]);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/preset/rich'));
    const body = (await res.json()) as { total: number; done: number; partial: number; missing: number };
    expect(body.total).toBe(32);
    expect(body.done).toBe(2);
    expect(body.partial).toBe(1);
    expect(body.missing).toBe(29);
  });

  it('items carry mechanism and source from PRESET_META_32', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-pr3' : '/demo-pr3';
    const demo = q.upsertDemo(demoPath);
    q.insertSession(demo.id);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/preset/rich'));
    const body = (await res.json()) as { items: PresetRichRow[] };
    const noSecrets = body.items.find((i) => i.id === 'no-hardcoded-secrets')!;
    expect(noSecrets).toBeDefined();
    expect(noSecrets.mechanism).toBe('static-grep');
    expect(noSecrets.source).toBe('OWASP-A02:2025');
    expect(noSecrets.appliesTo).toContain('W');
    expect(noSecrets.appliesTo).toContain('ML');
  });
});
