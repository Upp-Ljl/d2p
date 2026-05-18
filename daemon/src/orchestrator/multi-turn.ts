import type Database from 'better-sqlite3';
import {
  upsertCcSession,
  appendCcTurnEvent,
  writeScratchpadNote,
} from '../storage/cc-sessions.js';
import type { TurnDonePayload, StreamHandle } from '../engines/claude-stream.js';

// Multi-turn driver. Owns the loop:
//   1. caller hands us a freshly-spawned StreamHandle (from claude-stream.ts)
//      that has its initial prompt already written
//   2. we listen for onTurnDone payloads via the bind() callback the launcher
//      hands us inside opts.onTurnDone
//   3. each turn → persist (scratchpad note + cc_sessions + cc_turn_events)
//      then decide continue/stop
//   4. when we decide to continue, call handle.writeNextTurn(followupPrompt);
//      when we decide to stop, resolve the driver's promise so the orchestrator
//      can move into reviewer pipeline
//
// Stop conditions (any one → stop):
//   - implementer self-reported complete (keyword scan on lastAssistantText)
//   - turn cap reached (default 12)
//   - elapsed cap reached (default 6h)
//   - stagnation: ≥3 turns where lastAssistantText delta vs prior is below
//     a small Levenshtein-free heuristic — see _isStagnating below
//   - caller-requested abort via the AbortSignal

export type MultiTurnStopReason =
  | 'self-reported-complete'
  | 'turn-cap'
  | 'time-cap'
  | 'stagnation'
  | 'aborted'
  | 'stream-error';

export interface MultiTurnDriverConfig {
  runId: string;
  role: string;
  maxTurns?: number;
  capMs?: number;
  /** Returns the prompt to send to cc for the next turn. Default just nudges
   *  cc to keep going; callers can override with task-specific guidance. */
  buildContinuePrompt?: (ctx: { turnIndex: number; lastAssistantText: string | null }) => string;
  /** Signals self-report completion. Default scans for "完成" / "done" /
   *  "finished" / "self-report" patterns in lastAssistantText. */
  isSelfReportedComplete?: (text: string | null) => boolean;
  signal?: AbortSignal;
}

export interface MultiTurnDriverResult {
  reason: MultiTurnStopReason;
  turnsRan: number;
  sessionId: string | null;
  elapsedMs: number;
}

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_CAP_MS = 6 * 60 * 60 * 1000; // 6h
const STAGNATION_WINDOW = 3;
const STAGNATION_MIN_DELTA = 0.15; // share of new chars vs prior turn

const SELF_REPORT_RE = /(自报完成|已完成|all done|finished|self[\s-]report.*complete|implementation complete|task complete|reviewer ready)/i;

export function defaultIsSelfReportedComplete(text: string | null): boolean {
  if (!text || !text.trim()) return false;
  return SELF_REPORT_RE.test(text);
}

export function defaultContinuePrompt(ctx: {
  turnIndex: number;
  lastAssistantText: string | null;
}): string {
  return `Continue. If the work is fully complete (code + tests + docs all in place and verified), say "task complete" and stop. Otherwise pick up where you left off — turn ${ctx.turnIndex + 1}.`;
}

/** Crude "is this turn saying the same thing as before?" check. Returns
 *  fraction of characters that differ between current and prior text — small
 *  number means little new information. */
function turnDelta(curr: string | null, prev: string | null): number {
  if (!curr || !prev) return 1; // no comparison possible → not stagnating
  if (curr.length === 0 || prev.length === 0) return 1;
  // Symmetric Jaccard over 32-byte shingles — cheap + good enough.
  const shingles = (s: string): Set<string> => {
    const out = new Set<string>();
    const norm = s.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i + 32 <= norm.length; i++) out.add(norm.slice(i, i + 32));
    return out;
  };
  const a = shingles(curr);
  const b = shingles(prev);
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  if (union === 0) return 1;
  const jaccard = inter / union;
  return 1 - jaccard;
}

function runMultiTurnInternal(
  db: Database.Database,
  handle: StreamHandle,
  cfg: MultiTurnDriverConfig,
  bindOnTurn: (cb: (p: TurnDonePayload) => void) => void,
): Promise<MultiTurnDriverResult> {
  const maxTurns = cfg.maxTurns ?? DEFAULT_MAX_TURNS;
  const capMs = cfg.capMs ?? DEFAULT_CAP_MS;
  const buildContinue = cfg.buildContinuePrompt ?? defaultContinuePrompt;
  const isComplete = cfg.isSelfReportedComplete ?? defaultIsSelfReportedComplete;

  const start = Date.now();
  const assistantHistory: (string | null)[] = [];
  let turnsRan = 0;
  let sessionId: string | null = null;
  let settled = false;

  return new Promise<MultiTurnDriverResult>((resolve) => {
    const finish = (reason: MultiTurnStopReason) => {
      if (settled) return;
      settled = true;
      cfg.signal?.removeEventListener('abort', onAbort);
      handle.child.removeListener('exit', onExit);
      resolve({
        reason,
        turnsRan,
        sessionId: sessionId ?? handle.getSessionId(),
        elapsedMs: Date.now() - start,
      });
    };

    const onAbort = () => finish('aborted');
    cfg.signal?.addEventListener('abort', onAbort);

    const onExit = () => finish('stream-error');
    handle.child.once('exit', onExit);

    bindOnTurn((payload: TurnDonePayload) => {
      if (settled) return;
      turnsRan += 1;
      sessionId = payload.sessionId ?? sessionId;
      assistantHistory.push(payload.lastAssistantText ?? null);

      // Persist turn → DB
      try {
        if (sessionId) {
          upsertCcSession(db, {
            runId: cfg.runId,
            role: cfg.role,
            ccSessionId: sessionId,
            turnIdx: payload.turnIndex,
          });
        }
        appendCcTurnEvent(db, {
          runId: cfg.runId,
          turnIdx: payload.turnIndex,
          source: payload.source === 'hook' ? 'stop' : 'result',
          payload: payload.raw,
        });
        if (payload.lastAssistantText) {
          writeScratchpadNote(db, {
            runId: cfg.runId,
            turnIdx: payload.turnIndex,
            text: payload.lastAssistantText.slice(0, 4096),
          });
        }
      } catch (e) {
        // DB write failure should not crash the driver — log + continue.
        appendCcTurnEvent(db, {
          runId: cfg.runId,
          turnIdx: payload.turnIndex,
          source: 'error',
          payload: { message: (e as Error).message },
        });
      }

      // Stop conditions
      if (isComplete(payload.lastAssistantText)) {
        finish('self-reported-complete');
        return;
      }
      if (turnsRan >= maxTurns) {
        finish('turn-cap');
        return;
      }
      if (Date.now() - start >= capMs) {
        finish('time-cap');
        return;
      }
      // Stagnation: need at least STAGNATION_WINDOW recent turns.
      if (assistantHistory.length >= STAGNATION_WINDOW) {
        let allStagnant = true;
        const recent = assistantHistory.slice(-STAGNATION_WINDOW);
        for (let i = 1; i < recent.length; i++) {
          if (turnDelta(recent[i] ?? null, recent[i - 1] ?? null) >= STAGNATION_MIN_DELTA) {
            allStagnant = false;
            break;
          }
        }
        if (allStagnant) {
          finish('stagnation');
          return;
        }
      }

      // Continue: write next turn
      const next = buildContinue({
        turnIndex: payload.turnIndex,
        lastAssistantText: payload.lastAssistantText,
      });
      if (!handle.writeNextTurn(next)) {
        finish('stream-error');
      }
    });
  });
}

// Each createMultiTurnDriver() returns an independent closure — safe for
// concurrent drivers. Pattern:
//
//   const driver = createMultiTurnDriver();
//   const handle = launchStreamRun({...}, { onTurnDone: driver.onTurn });
//   const result = await driver.run(db, handle, cfg);

export function createMultiTurnDriver() {
  let bound: ((p: TurnDonePayload) => void) | null = null;
  // Turns that arrive before run() bound a callback queue here so we don't
  // drop them (e.g. cc finishes turn 0 before the orchestrator's await
  // schedule has run).
  const earlyQueue: TurnDonePayload[] = [];

  const onTurn = (p: TurnDonePayload): void => {
    if (bound) bound(p);
    else earlyQueue.push(p);
  };

  const bindOnTurn = (cb: (p: TurnDonePayload) => void) => {
    bound = cb;
    while (earlyQueue.length > 0) {
      const p = earlyQueue.shift()!;
      cb(p);
    }
  };

  return {
    onTurn,
    run: (
      db: Database.Database,
      handle: StreamHandle,
      cfg: MultiTurnDriverConfig,
    ): Promise<MultiTurnDriverResult> => runMultiTurnInternal(db, handle, cfg, bindOnTurn),
  };
}

/** Convenience for tests/single-instance callers. */
export function runMultiTurn(
  db: Database.Database,
  handle: StreamHandle,
  cfg: MultiTurnDriverConfig,
  onTurnHandle: (cb: (p: TurnDonePayload) => void) => void,
): Promise<MultiTurnDriverResult> {
  return runMultiTurnInternal(db, handle, cfg, onTurnHandle);
}

export const __test__ = {
  turnDelta,
};
