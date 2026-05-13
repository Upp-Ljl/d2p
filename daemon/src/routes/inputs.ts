import { Hono } from 'hono';
import { queries } from './session.js';
import { listInputs, writeInput } from '../inputs/store.js';

export const inputRoutes = new Hono();

inputRoutes.get('/', async (c) => {
  const session = queries.getCurrentActiveSession() ?? queries.getLatestSession();
  if (!session) return c.json({ inputs: [] });
  const demo = queries.getDemo(session.demoId);
  if (!demo) return c.json({ inputs: [] });
  const inputs = await listInputs(demo.path as unknown as string);
  return c.json({ inputs });
});

inputRoutes.post('/', async (c) => {
  // Accept any session not yet ENDED — user may want to attach inputs in
  // SETUP, LOOPING, PAUSED, or even DONE before they hit "end session".
  const session = queries.getCurrentActiveSession() ?? queries.getLatestSession();
  if (!session || session.status === 'ENDED') {
    return c.json(
      { type: 'about:blank', title: 'no usable session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  const demo = queries.getDemo(session.demoId);
  if (!demo) {
    return c.json({ type: 'about:blank', title: 'demo missing', status: 500, code: 'INTERNAL' }, 500);
  }
  let body: { name?: string; body?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ type: 'about:blank', title: 'bad json', status: 400, code: 'BAD_REQUEST' }, 400);
  }
  if (!body.name || typeof body.body !== 'string') {
    return c.json(
      { type: 'about:blank', title: 'name + body required', status: 400, code: 'BAD_REQUEST' },
      400,
    );
  }
  const r = await writeInput(demo.path as unknown as string, body.name, body.body);
  if (!r.ok) {
    return c.json(
      { type: 'about:blank', title: r.error, status: 400, code: 'BAD_REQUEST' },
      400,
    );
  }
  return c.json({ ok: true, path: r.path });
});
