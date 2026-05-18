import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { dbHandle } from './session.js';
import {
  listCcTurnEvents,
  readScratchpad,
  getCcSession,
} from '../storage/cc-sessions.js';

// SSE endpoint feeding the UI's multi-turn panel. The route is run-scoped:
//   GET /api/cc-stream/:runId
//
// First response chunk is a snapshot of everything we have for this run so
// far (cc_turn_events from id=0 + scratchpad + cc_sessions). Subsequent
// chunks are diffs the route polls cc_turn_events for (sinceId increments)
// every 500ms. Polling is fine because writes are append-only and frequency
// is low (cc emits a handful of events per turn).
//
// The UI shape is MultiTurnState (defined in ui/src/types.ts). The daemon
// can't import the UI type, so we emit a flat JSON payload the store maps
// to that interface client-side.

export const ccStreamRoutes = new Hono();

ccStreamRoutes.get('/:runId', (c) => {
  const runId = c.req.param('runId');
  if (!runId) {
    return c.json(
      { type: 'about:blank', title: 'runId required', status: 400, code: 'BAD_REQUEST' },
      400,
    );
  }

  return streamSSE(c, async (stream) => {
    let lastEventId = 0;
    let closed = false;

    stream.onAbort(() => {
      closed = true;
    });

    const writeSnapshot = async () => {
      const events = listCcTurnEvents(dbHandle, runId, { sinceId: lastEventId });
      const scratchpad = readScratchpad(dbHandle, runId);
      const implSess = getCcSession(dbHandle, runId, 'implementer');
      if (events.length > 0) lastEventId = events[events.length - 1]!.id;
      await stream.writeSSE({
        event: 'cc-stream',
        data: JSON.stringify({
          runId,
          newEvents: events.map((e) => ({
            id: e.id,
            turnIdx: e.turnIdx,
            source: e.source,
            payload: JSON.parse(e.payloadJson),
            ts: e.ts,
          })),
          scratchpad: scratchpad.map((n) => ({ turn: n.turnIdx, ts: n.ts, text: n.text })),
          ccSessionId: implSess?.ccSessionId ?? null,
          lastTurnIdx: implSess?.lastTurnIdx ?? 0,
        }),
      });
    };

    // Initial snapshot
    try {
      await writeSnapshot();
    } catch {
      closed = true;
    }

    // Poll for new events. 500ms is well below the per-turn cadence (~seconds)
    // and well above the cost-per-poll of a single SELECT against an indexed
    // (run_id, id) lookup, so this never becomes the bottleneck.
    const heartbeat = setInterval(async () => {
      if (closed) return;
      try {
        await stream.writeSSE({ event: 'heartbeat', data: JSON.stringify({ ts: Date.now() }) });
      } catch {
        closed = true;
      }
    }, 15_000);

    try {
      while (!closed) {
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        if (closed) break;
        try {
          await writeSnapshot();
        } catch {
          closed = true;
        }
      }
    } finally {
      clearInterval(heartbeat);
    }
  });
});
