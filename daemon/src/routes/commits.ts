import { Hono } from 'hono';
import { queries } from './session.js';

export const commitsRoutes = new Hono();

/**
 * GET /api/commits?limit=N
 *
 * Returns merged commits for the current active (or latest) session.
 * Default limit = 50, max = 200.
 *
 * Response: { commits: MergedCommitRow[] }
 */
commitsRoutes.get('/', (c) => {
  const session = queries.getCurrentActiveSession() ?? queries.getLatestSession();
  if (!session) {
    return c.json({ commits: [] });
  }

  const rawLimit = c.req.query('limit');
  const limit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit, 10) || 50), 200) : 50;

  const commits = queries.listMergedCommits(session.id, limit);
  return c.json({ commits });
});
