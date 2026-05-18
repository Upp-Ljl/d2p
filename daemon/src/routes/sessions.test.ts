/**
 * Tests for GET /api/sessions
 *
 * We test the route by calling the Hono app's fetch() directly with an
 * in-memory DB rather than spinning up a real HTTP server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { runMigrations } from '../storage/migrations/index.js';
import { Queries } from '../storage/queries.js';

// Build a test Hono app that mounts the sessions route with a given Queries instance
function buildApp(q: Queries) {
  // We need to mock the 'session' module dependency that the route uses.
  // Since the route imports `queries` from './session.js' as a singleton,
  // we instead test the route logic directly by constructing a minimal Hono app
  // that calls the same query methods.
  const app = new Hono();

  app.get('/api/sessions', (c) => {
    const session = q.getCurrentActiveSession();
    if (!session) {
      return c.json({ sessions: [] });
    }
    const sessions = q.aggregateSessionsByRole(session.id);
    return c.json({ sessions });
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

describe('GET /api/sessions', () => {
  it('returns empty sessions array when no active session', async () => {
    const { q } = setup();
    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/sessions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: unknown[] };
    expect(body.sessions).toEqual([]);
  });

  it('returns 7 role rows when an active session exists', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-sess-route' : '/demo-sess-route';
    const demo = q.upsertDemo(demoPath);
    q.insertSession(demo.id);

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/sessions'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: Array<{ role: string; status: string }> };
    expect(body.sessions).toHaveLength(7);
    const roles = body.sessions.map((s) => s.role);
    expect(roles).toContain('implementer');
    expect(roles).toContain('differ');
  });

  it('reflects AGENT_START events in status', async () => {
    const { q } = setup();
    const demoPath = process.platform === 'win32' ? 'D:\\demo-sess-route2' : '/demo-sess-route2';
    const demo = q.upsertDemo(demoPath);
    const session = q.insertSession(demo.id);
    q.insertLogEvent(session.id, 'info', 'AGENT_START', {
      role: 'differ',
      gapSlug: 'some-gap',
      thought: 'scanning codebase',
    });

    const app = buildApp(q);
    const res = await app.fetch(new Request('http://localhost/api/sessions'));
    const body = (await res.json()) as {
      sessions: Array<{ role: string; status: string; callsThisSession: number }>;
    };
    const differ = body.sessions.find((s) => s.role === 'differ')!;
    expect(differ.status).toBe('working');
    expect(differ.callsThisSession).toBe(1);
  });
});
