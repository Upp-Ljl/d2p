import { Hono } from 'hono';
import { queries } from './session.js';
import { detectDeployTargets } from '../deploy/detect.js';

export const deployRoutes = new Hono();

deployRoutes.get('/targets', async (c) => {
  const session = queries.getCurrentActiveSession() ?? queries.getLatestSession();
  if (!session) return c.json({ targets: [] });
  const demo = queries.getDemo(session.demoId);
  if (!demo) return c.json({ targets: [] });
  const targets = await detectDeployTargets(demo.path as unknown as string);
  return c.json({ targets });
});
