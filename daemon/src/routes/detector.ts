import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { queries } from './session.js';
import { runDetector } from '../agents/detector.js';
import { emit } from '../orchestrator/controller.js';

export const detectorRoutes = new Hono();

detectorRoutes.post('/run', async (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json(
      { type: 'about:blank', title: 'no active session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  const demo = queries.getDemo(session.demoId);
  if (!demo) {
    return c.json({ type: 'about:blank', title: 'demo missing', status: 500, code: 'INTERNAL' }, 500);
  }
  const out = await runDetector(queries, session.id, demo.path as unknown as string);
  if ('error' in out) {
    return c.json(
      { type: 'about:blank', title: 'detector failed', status: 502, code: 'INTERNAL', detail: out.error },
      502,
    );
  }
  queries.setDemoInferredType(demo.id, out.type);
  emit(queries, session.id, 'TYPE_DETECTED', {
    type: out.type,
    confidence: out.confidence,
  });
  // persist inferred check-commands if not present
  const ccPath = path.join(demo.path as unknown as string, '.d2p', 'check-commands.yaml');
  try {
    await mkdir(path.dirname(ccPath), { recursive: true });
    await writeFile(ccPath, yamlStringify(out.inferredCheckCommands), { flag: 'wx' });
  } catch {
    // already exists or other; ignore
  }
  return c.json(out);
});
