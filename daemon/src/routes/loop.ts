import { Hono } from 'hono';
import { queries } from './session.js';
import { loopController } from '../orchestrator/controller.js';
import { runLoop } from '../orchestrator/loop.js';

export const loopRoutes = new Hono();

loopRoutes.post('/start', (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json(
      { type: 'about:blank', title: 'no active session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  if (loopController.isRunning()) {
    return c.json({ status: 'LOOPING', alreadyRunning: true });
  }
  if (session.status !== 'SETUP' && session.status !== 'PAUSED') {
    return c.json(
      {
        type: 'about:blank',
        title: 'session not in startable state',
        status: 409,
        code: 'INVALID_STATE',
        detail: `session is ${session.status}`,
      },
      409,
    );
  }
  if (!session.presetType) {
    return c.json(
      { type: 'about:blank', title: 'preset not chosen', status: 400, code: 'BAD_REQUEST' },
      400,
    );
  }
  if (!session.visionMdPath) {
    return c.json(
      { type: 'about:blank', title: 'vision not finalized', status: 400, code: 'BAD_REQUEST' },
      400,
    );
  }
  loopController.start(session.id, async () => {
    try {
      await runLoop({ queries }, session.id);
    } catch (e) {
      console.error('[d2p loop] crashed:', e);
    }
  });
  return c.json({ status: 'LOOPING' });
});

loopRoutes.post('/pause', (c) => {
  if (!loopController.isRunning()) {
    const session = queries.getCurrentActiveSession();
    return c.json({ status: session?.status ?? 'NONE', wasRunning: false });
  }
  loopController.requestPause();
  return c.json({ status: 'PAUSING' });
});

loopRoutes.post('/resume', (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json(
      { type: 'about:blank', title: 'no active session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  if (session.status !== 'PAUSED') {
    return c.json(
      {
        type: 'about:blank',
        title: 'session not paused',
        status: 409,
        code: 'INVALID_STATE',
        detail: `session is ${session.status}`,
      },
      409,
    );
  }
  if (loopController.isRunning()) {
    loopController.resume();
    return c.json({ status: 'LOOPING' });
  }
  loopController.start(session.id, async () => {
    try {
      await runLoop({ queries }, session.id);
    } catch (e) {
      console.error('[d2p loop] crashed:', e);
    }
  });
  return c.json({ status: 'LOOPING' });
});

loopRoutes.get('/state', (c) => {
  return c.json({
    isRunning: loopController.isRunning(),
    pauseRequested: loopController.pauseRequested(),
    sessionId: loopController.currentSessionId(),
  });
});
