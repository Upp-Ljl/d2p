import { sseHub } from '../log/sse.js';
import type { Queries } from '../storage/queries.js';
import type { LogEventKind } from '../types.js';

export interface ControllerState {
  isRunning: boolean;
  pauseRequested: boolean;
  sessionId: number | null;
}

export class LoopController {
  private state: ControllerState = {
    isRunning: false,
    pauseRequested: false,
    sessionId: null,
  };
  private promise: Promise<void> | null = null;

  isRunning(): boolean {
    return this.state.isRunning;
  }
  pauseRequested(): boolean {
    return this.state.pauseRequested;
  }
  currentSessionId(): number | null {
    return this.state.sessionId;
  }

  /**
   * Start the loop. Fire-and-forget; the runner promise is retained so
   * `awaitLoop()` can join in tests.
   */
  start(sessionId: number, run: (signal: { paused: () => boolean }) => Promise<void>): void {
    if (this.state.isRunning) {
      throw new Error(`loop already running for session ${this.state.sessionId}`);
    }
    this.state.isRunning = true;
    this.state.pauseRequested = false;
    this.state.sessionId = sessionId;
    const signal = { paused: () => this.state.pauseRequested };
    this.promise = run(signal).finally(() => {
      this.state.isRunning = false;
      this.state.pauseRequested = false;
      this.state.sessionId = null;
    });
  }

  requestPause(): void {
    if (this.state.isRunning) this.state.pauseRequested = true;
  }

  resume(): void {
    this.state.pauseRequested = false;
  }

  /** For tests: await the in-flight loop. */
  awaitLoop(): Promise<void> {
    return this.promise ?? Promise.resolve();
  }
}

export const loopController = new LoopController();

/** Insert log event and publish via SSE. Helper used across orchestrator. */
export function emit(
  q: Queries,
  sessionId: number,
  kind: LogEventKind,
  payload: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
): void {
  const event = q.insertLogEvent(sessionId, level, kind, payload);
  sseHub.publish({
    id: event.id,
    ts: event.ts,
    kind,
    level,
    payload: event.payload,
  });
}
