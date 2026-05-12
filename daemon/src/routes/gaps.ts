import { Hono } from 'hono';
import { queries } from './session.js';
import { emit } from '../orchestrator/controller.js';
import type { GapStatus } from '../types.js';

export const gapRoutes = new Hono();

const ALL_STATUSES: GapStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'NEED_HUMAN', 'SPLIT_DONE'];

gapRoutes.get('/', (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) return c.json({ gaps: [] });

  const statusParams = c.req.queries('status') ?? [];
  const filter = statusParams.filter((s) => (ALL_STATUSES as string[]).includes(s)) as GapStatus[];
  const gaps = queries.listGaps(session.id, filter.length ? filter : undefined);
  return c.json({ gaps });
});

gapRoutes.post('/:id/skip', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) {
    return c.json({ type: 'about:blank', title: 'bad id', status: 400, code: 'BAD_REQUEST' }, 400);
  }
  try {
    queries.transitionGap(id, 'SKIPPED');
  } catch (e) {
    return c.json(
      {
        type: 'about:blank',
        title: 'illegal transition',
        status: 409,
        code: 'INVALID_STATE',
        detail: (e as Error).message,
      },
      409,
    );
  }
  const session = queries.getCurrentActiveSession();
  if (session) emit(queries, session.id, 'GAP_SKIPPED', { gapId: id });
  return c.json({ id, status: 'SKIPPED' });
});
