import { Hono } from 'hono';
import { queries } from './session.js';
import { runVisionRound } from '../agents/vision.js';
import { emit } from '../orchestrator/controller.js';
import { finalizeVisionFile } from '../orchestrator/loop.js';

export const visionRoutes = new Hono();

const MAX_ROUNDS = 5;

visionRoutes.get('/round', async (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json(
      { type: 'about:blank', title: 'no active session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  if (session.visionMdPath) {
    const fs = await import('node:fs/promises');
    const visionMd = await fs
      .readFile(session.visionMdPath as unknown as string, 'utf8')
      .catch(() => '');
    return c.json({ done: true, visionMd, visionMdPath: session.visionMdPath });
  }

  const demo = queries.getDemo(session.demoId);
  if (!demo) {
    return c.json({ type: 'about:blank', title: 'demo missing', status: 500, code: 'INTERNAL' }, 500);
  }

  const drafts = queries.listVisionDrafts(session.id);
  const roundIndex = Math.min(queries.maxVisionRound(session.id) + 1, MAX_ROUNDS);

  const out = await runVisionRound(
    queries,
    session.id,
    demo.path as unknown as string,
    session.presetType ?? 'unknown',
    drafts.map((d) => ({ question: d.question, answer: d.answer })),
    roundIndex,
  );
  if ('error' in out) {
    return c.json(
      { type: 'about:blank', title: 'vision agent failed', status: 502, code: 'INTERNAL', detail: out.error },
      502,
    );
  }

  if (out.done) {
    const file = await finalizeVisionFile(queries, session, demo.path as unknown as string, out.visionMd);
    return c.json({ done: true, visionMd: out.visionMd, visionMdPath: file });
  }
  emit(queries, session.id, 'VISION_QUESTION_ASKED', { roundIndex, count: out.questions.length });
  return c.json({ done: false, roundIndex, questions: out.questions });
});

visionRoutes.post('/answer', async (c) => {
  const session = queries.getCurrentActiveSession();
  if (!session) {
    return c.json(
      { type: 'about:blank', title: 'no active session', status: 409, code: 'INVALID_STATE' },
      409,
    );
  }
  let body: { answers?: Array<{ questionId: string; answer: string; question?: string }> };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ type: 'about:blank', title: 'bad json', status: 400, code: 'BAD_REQUEST' }, 400);
  }
  const answers = body.answers ?? [];
  const roundIndex = Math.max(1, queries.maxVisionRound(session.id));
  for (const a of answers) {
    queries.upsertVisionDraft({
      sessionId: session.id,
      roundIndex,
      questionId: a.questionId,
      question: a.question ?? a.questionId,
      answer: a.answer,
    });
    emit(queries, session.id, 'VISION_ANSWERED', { questionId: a.questionId });
  }
  // Return next round
  const demo = queries.getDemo(session.demoId);
  if (!demo) {
    return c.json({ type: 'about:blank', title: 'demo missing', status: 500, code: 'INTERNAL' }, 500);
  }
  const drafts = queries.listVisionDrafts(session.id);
  const nextRound = Math.min(roundIndex + 1, MAX_ROUNDS);
  const out = await runVisionRound(
    queries,
    session.id,
    demo.path as unknown as string,
    session.presetType ?? 'unknown',
    drafts.map((d) => ({ question: d.question, answer: d.answer })),
    nextRound,
  );
  if ('error' in out) {
    return c.json(
      { type: 'about:blank', title: 'vision agent failed', status: 502, code: 'INTERNAL', detail: out.error },
      502,
    );
  }
  if (out.done) {
    const file = await finalizeVisionFile(queries, session, demo.path as unknown as string, out.visionMd);
    return c.json({ done: true, visionMd: out.visionMd, visionMdPath: file });
  }
  return c.json({ done: false, roundIndex: nextRound, questions: out.questions });
});

visionRoutes.post('/finalize', async (c) => {
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
  const drafts = queries.listVisionDrafts(session.id);
  // Force-finalize by calling vision agent with roundIndex=MAX (it should return done:true)
  const out = await runVisionRound(
    queries,
    session.id,
    demo.path as unknown as string,
    session.presetType ?? 'unknown',
    drafts.map((d) => ({ question: d.question, answer: d.answer })),
    MAX_ROUNDS,
  );
  if ('error' in out) {
    return c.json(
      { type: 'about:blank', title: 'vision agent failed', status: 502, code: 'INTERNAL', detail: out.error },
      502,
    );
  }
  if (!out.done) {
    // Fallback: synthesize a minimal vision_md from drafts
    const body =
      `# Vision: ${demo.path}\n\n` +
      drafts.map((d) => `## ${d.question}\n\n${d.answer}\n`).join('\n');
    const file = await finalizeVisionFile(queries, session, demo.path as unknown as string, body);
    return c.json({ done: true, visionMd: body, visionMdPath: file });
  }
  const file = await finalizeVisionFile(queries, session, demo.path as unknown as string, out.visionMd);
  return c.json({ done: true, visionMd: out.visionMd, visionMdPath: file });
});
