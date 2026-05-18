import { Hono } from 'hono';
import { queries } from './session.js';

export const sessionsRoutes = new Hono();

/**
 * GET /api/sessions
 *
 * Returns per-role agent aggregation for the current active session.
 * If no session is active, returns an empty array.
 *
 * Response: { sessions: AgentSessionAgg[] }
 */
sessionsRoutes.get('/', (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json({ sessions: [] });
  }
  const sessions = queries.aggregateSessionsByRole(session.id);
  return c.json({ sessions });
});
