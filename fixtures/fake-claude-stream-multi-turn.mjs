#!/usr/bin/env node
// Multi-turn fake `claude --output-format stream-json --input-format stream-json`.
// Used by scripts/smoke-multi-turn.mjs to drive runImplementerMultiTurn end-to-end
// without touching the real cc binary.
//
// Behavior:
//   - Reads NDJSON user-turn envelopes from stdin
//   - For each user turn, emits:
//       SessionStart hook (turn 1 only)
//       assistant event
//       Stop hook with last_assistant_message
//   - Turn 1: "scanning… not done yet"
//   - Turn 2: "wrote middleware, tests still failing"
//   - Turn 3: "all done — task complete"  → triggers self-reported-complete
//   - After turn 3, also emits a result event and exits 0

import { stdin, stdout } from 'node:process';

const SESSION_ID = 'fake-session-multi-turn';

function write(obj) {
  stdout.write(JSON.stringify(obj) + '\n');
}

const TURN_SCRIPTS = [
  {
    assistantText: 'turn 1: scanning code base for affected files. found 4 routes to update.',
    lastMessage: 'turn 1: scanning code base for affected files. found 4 routes to update.',
    complete: false,
  },
  {
    assistantText: 'turn 2: middleware drafted; running tests — 3 failures around env loading.',
    lastMessage: 'turn 2: middleware drafted; running tests — 3 failures around env loading.',
    complete: false,
  },
  {
    assistantText: 'turn 3: tests pass 14/14, lint clean — all done, task complete.',
    lastMessage: 'turn 3: tests pass 14/14, lint clean — all done, task complete.',
    complete: true,
  },
];

let turnIdx = 0;
let buf = '';

stdin.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    // We don't even parse the line — we just count it as a turn trigger.
    handleTurn(turnIdx);
    turnIdx++;
  }
});

stdin.on('end', () => {
  // launcher closed stdin — exit cleanly with a result event if we have any.
  finalExit();
});

function handleTurn(idx) {
  const script = TURN_SCRIPTS[idx] ?? TURN_SCRIPTS[TURN_SCRIPTS.length - 1];

  // SessionStart only on the very first turn.
  if (idx === 0) {
    setTimeout(() => {
      write({
        type: 'system',
        subtype: 'hook_response',
        hook_event: 'SessionStart',
        session_id: SESSION_ID,
        stdout: JSON.stringify({
          transcript_path: '/tmp/fake-transcript.jsonl',
          session_id: SESSION_ID,
        }),
        stderr: '',
        exit_code: 0,
      });
    }, 20);
  }

  // Assistant event.
  setTimeout(() => {
    write({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: script.assistantText }],
      },
      session_id: SESSION_ID,
    });
  }, 50);

  // Stop hook.
  setTimeout(() => {
    write({
      type: 'system',
      subtype: 'hook_response',
      hook_event: 'Stop',
      session_id: SESSION_ID,
      stdout: JSON.stringify({
        session_id: SESSION_ID,
        transcript_path: '/tmp/fake-transcript.jsonl',
        last_assistant_message: script.lastMessage,
        stop_hook_active: false,
      }),
      stderr: '',
      exit_code: 0,
    });
    // If this is the final turn, emit result + exit.
    if (script.complete) {
      setTimeout(() => {
        write({
          type: 'result',
          subtype: 'success',
          session_id: SESSION_ID,
          is_error: false,
        });
        setTimeout(() => process.exit(0), 30);
      }, 60);
    }
  }, 120);
}

function finalExit() {
  setTimeout(() => process.exit(0), 50);
}
