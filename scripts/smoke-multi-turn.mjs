#!/usr/bin/env node
// scripts/smoke-multi-turn.mjs — Batch 6 smoke for the multi-turn import.
//
// Drives launchStreamRun + createMultiTurnDriver against
// fixtures/fake-claude-stream-multi-turn.mjs (a 3-turn fake cc that
// self-reports complete on turn 3). Validates:
//
//   1. driver receives 3 onTurnDone payloads
//   2. driver stop reason is "self-reported-complete"
//   3. cc_sessions persists session_id "fake-session-multi-turn"
//   4. cc_turn_events has 3 stop events
//   5. cc_scratchpad has 3 notes
//   6. final sessionId echoed back through the driver result
//
// Run with: node scripts/smoke-multi-turn.mjs
//
// Pass --report-json for a deterministic JSON dump (used by the FEATURE-VALIDATION
// 1+2+3 cross-engine probe).

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const daemonRoot = path.join(repoRoot, 'daemon');
const distMarker = path.join(daemonRoot, 'dist');

if (!fs.existsSync(distMarker)) {
  console.error('daemon/dist missing — run `npm --workspace daemon run build` first.');
  process.exit(1);
}

const distUrl = (sub) => pathToFileURL(path.join(daemonRoot, 'dist', sub)).href;

const { default: Database } = await import('better-sqlite3');
const { runMigrations } = await import(distUrl('storage/migrations/index.js'));
const { launchStreamRun } = await import(distUrl('engines/claude-stream.js'));
const { createMultiTurnDriver } = await import(distUrl('orchestrator/multi-turn.js'));
const { listCcTurnEvents, readScratchpad, getCcSession } = await import(
  distUrl('storage/cc-sessions.js')
);

const reportJson = process.argv.includes('--report-json');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2p-smoke-mt-'));
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'd2p-smoke-cwd-'));
const d2pHome = fs.mkdtempSync(path.join(os.tmpdir(), 'd2p-smoke-home-'));

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
runMigrations(db);

const fakePath = path.join(repoRoot, 'fixtures', 'fake-claude-stream-multi-turn.mjs');

const driver = createMultiTurnDriver();
const handle = launchStreamRun(
  {
    cwd,
    prompt: 'Initial implementer prompt for the smoke test',
    runId: 'r-smoke-1',
    role: 'implementer',
  },
  {
    claudeBin: fakePath,
    tmpDir,
    d2pHome,
    idleTimeoutMs: 30_000,
    onTurnDone: driver.onTurn,
  },
);

const result = await driver.run(db, handle, {
  runId: 'r-smoke-1',
  role: 'implementer',
  maxTurns: 6,
});

// Wait briefly for stdin propagation to finish + cc to actually exit.
await new Promise((resolve) => {
  if (handle.child.exitCode != null) resolve();
  else handle.child.once('exit', () => resolve());
});

// Collect post-state.
const sess = getCcSession(db, 'r-smoke-1', 'implementer');
const events = listCcTurnEvents(db, 'r-smoke-1');
const scratchpad = readScratchpad(db, 'r-smoke-1');
const stopEvents = events.filter((e) => e.source === 'stop');
const resultEvents = events.filter((e) => e.source === 'result');

const checks = [
  { name: 'stop_reason_is_self_reported', pass: result.reason === 'self-reported-complete' },
  { name: 'turns_ran_equals_3', pass: result.turnsRan === 3 },
  { name: 'session_persisted', pass: sess?.ccSessionId === 'fake-session-multi-turn' },
  { name: 'driver_session_id', pass: result.sessionId === 'fake-session-multi-turn' },
  { name: 'stop_events_count_3', pass: stopEvents.length === 3 },
  { name: 'scratchpad_notes_3', pass: scratchpad.length === 3 },
  { name: 'scratchpad_turn_3_complete', pass: (scratchpad.at(-1)?.text ?? '').includes('task complete') },
];

const allPass = checks.every((c) => c.pass);

if (reportJson) {
  console.log(
    JSON.stringify(
      {
        turn_count: result.turnsRan,
        session_persisted: !!sess,
        scratchpad_notes: scratchpad.length,
        reviewer_calls: 0, // smoke does not invoke reviewer
        resume_arg_seen: false, // first run, no resume
        stop_reason: result.reason,
      },
      null,
      0,
    ),
  );
} else {
  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}`);
  }
  console.log('');
  console.log(`stop reason: ${result.reason}`);
  console.log(`turns ran:   ${result.turnsRan}`);
  console.log(`session id:  ${result.sessionId}`);
  console.log(`scratchpad:  ${scratchpad.length} notes`);
}

db.close();
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {}
try { fs.rmSync(d2pHome, { recursive: true, force: true }); } catch {}

if (!allPass) {
  if (!reportJson) console.error('SMOKE FAILED');
  process.exit(2);
}
