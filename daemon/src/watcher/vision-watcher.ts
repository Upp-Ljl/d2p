// Live re-diff trigger: when vision.md or preset-overrides.yaml changes on
// disk, mark the session as "dirty" so the orchestrator's next iteration
// pulls fresh inputs and runs the differ again. Implements ABCD #D
// "持续陪跑" — user can edit vision.md and the loop reacts.

import path from 'node:path';
import { watch as fsWatch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { Queries } from '../storage/queries.js';
import { sseHub } from '../log/sse.js';

interface WatcherState {
  watchers: FSWatcher[];
  dirty: boolean;
}

const state = new Map<number, WatcherState>();

function emit(q: Queries, sessionId: number, kind: string, payload: Record<string, unknown>): void {
  const event = q.insertLogEvent(sessionId, 'info', kind as never, payload);
  sseHub.publish({
    id: event.id,
    ts: event.ts,
    kind: kind as never,
    level: 'info',
    payload: event.payload,
  });
}

export function startWatching(q: Queries, sessionId: number, demoPath: string): void {
  if (state.has(sessionId)) return; // already watching
  const d2pDir = path.join(demoPath, '.d2p');
  const watchers: FSWatcher[] = [];

  const onChange = (file: string) => {
    const s = state.get(sessionId);
    if (!s) return;
    s.dirty = true;
    emit(q, sessionId, 'VISION_QUESTION_ASKED', {
      _reason: 'watcher_dirty',
      file,
    });
  };

  for (const fname of ['vision.md', 'preset-overrides.yaml', 'check-commands.yaml']) {
    try {
      const w = fsWatch(path.join(d2pDir, fname), { persistent: false }, () => onChange(fname));
      watchers.push(w);
    } catch {
      // file may not exist yet; that's fine
    }
  }
  state.set(sessionId, { watchers, dirty: false });
}

export function stopWatching(sessionId: number): void {
  const s = state.get(sessionId);
  if (!s) return;
  for (const w of s.watchers) {
    try {
      w.close();
    } catch {
      // ignore
    }
  }
  state.delete(sessionId);
}

export function consumeDirty(sessionId: number): boolean {
  const s = state.get(sessionId);
  if (!s) return false;
  const was = s.dirty;
  s.dirty = false;
  return was;
}
