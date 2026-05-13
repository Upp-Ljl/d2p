#!/usr/bin/env node
// Smoke-only fake `claude` CLI. Spawned with cwd = worktree path for the
// implementer role, so it can shell out git inside the worktree. Delegates to
// fake-llm-core for the actual role-detection + canned responses.

import { respond } from './fake-llm-core.mjs';

const args = process.argv.slice(2);
const pIdx = args.indexOf('-p');
const prompt = pIdx >= 0 ? (args[pIdx + 1] ?? '') : '';

try {
  const { json, usage } = respond(prompt, { worktreePath: process.cwd() });
  process.stdout.write(JSON.stringify(json));
  process.stdout.write(`\nUSAGE: input=${usage.input} output=${usage.output}\n`);
  process.exit(0);
} catch (e) {
  process.stderr.write(`fake-claude: ${e.message}\n`);
  process.exit(2);
}
