#!/usr/bin/env node
// End-to-end smoke for the `openai-compat` engine.
//
// 1. Starts scripts/fake-llm-server.mjs on a random port.
// 2. Writes ~/.d2p-smoke-engines-XXX/config.json with engine = openai-compat
//    pointing at the stub server.
// 3. Spawns the d2p daemon with D2P_CONFIG_PATH + isolated DB.
// 4. Runs the full session flow (start → detector → preset → vision → loop).
// 5. Asserts SESSION_DONE + at least one MERGED event.
//
// No real LLM credits burned. No real network calls.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DAEMON_PORT = 5474;
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;

const log = (...args) => console.log('[smoke-engines]', ...args);
const fail = (msg) => {
  console.error(`[smoke-engines] FAIL: ${msg}`);
  process.exit(1);
};

async function fetchJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url}: ${await r.text()}`);
  return r.json();
}

async function pollFor(url, predicate, timeoutMs = 60_000, intervalMs = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const v = await fetchJson(url);
      if (predicate(v)) return v;
    } catch {
      // ignore transient
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`polling ${url} timed out after ${timeoutMs}ms`);
}

async function waitForLine(child, pattern, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`waitForLine ${pattern} timed out`)), timeoutMs);
    const onData = (b) => {
      buf += b.toString();
      const m = pattern.exec(buf);
      if (m) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(m);
      }
    };
    child.stdout.on('data', onData);
  });
}

async function main() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'd2p-smoke-engines-'));
  const demoDir = path.join(tmp, 'demo-cli');
  const dbPath = path.join(tmp, 'state.db');
  const configPath = path.join(tmp, 'config.json');
  log('tmp:', tmp);

  // Fixture demo
  cpSync(path.join(repoRoot, 'fixtures', 'demo-cli'), demoDir, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: demoDir });
  spawnSync('git', ['add', '-A'], { cwd: demoDir });
  spawnSync(
    'git',
    ['-c', 'user.email=smoke@local', '-c', 'user.name=smoke', 'commit', '-q', '-m', 'chore: initial smoke commit'],
    { cwd: demoDir },
  );

  // Start stub LLM server
  log('starting fake-llm-server...');
  const stub = spawn(process.execPath, [path.join(__dirname, 'fake-llm-server.mjs'), '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  stub.stderr.on('data', (b) => process.stderr.write(`[stub-err] ${b}`));
  const portMatch = await waitForLine(stub, /PORT=(\d+)/);
  const stubPort = parseInt(portMatch[1], 10);
  const stubUrl = `http://127.0.0.1:${stubPort}/v1`;
  log('stub listening at', stubUrl);

  // Write config.json telling the daemon to use openai-compat against our stub
  mkdirSync(path.dirname(configPath), { recursive: true });
  const cfg = {
    engine: {
      kind: 'openai-compat',
      baseUrl: stubUrl,
      apiKey: 'sk-test-irrelevant',
      models: { haiku: 'fake-haiku', sonnet: 'fake-sonnet', opus: 'fake-opus' },
    },
  };
  writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  // Spawn daemon with isolated DB + the test config
  log('starting daemon...');
  const daemon = spawn(
    process.execPath,
    [path.join(repoRoot, 'daemon', 'dist', 'server.js')],
    {
      env: {
        ...process.env,
        D2P_DAEMON_PORT: String(DAEMON_PORT),
        D2P_DB_PATH: dbPath,
        D2P_CONFIG_PATH: configPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  daemon.stdout.on('data', (b) => process.stdout.write(`[daemon] ${b}`));
  daemon.stderr.on('data', (b) => process.stderr.write(`[daemon-err] ${b}`));

  const cleanup = () => {
    try { daemon.kill('SIGTERM'); } catch { /* ignore */ }
    try { stub.kill('SIGTERM'); } catch { /* ignore */ }
    try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  // Wait for daemon health
  log('waiting for daemon...');
  const health = await pollFor(`${DAEMON_URL}/api/health`, (h) => h?.daemonVersion, 30_000);
  log('daemon up:', health.daemonVersion);

  // Verify daemon picked up the openai-compat engine via /api/config
  const cfgRes = await fetchJson(`${DAEMON_URL}/api/config`);
  if (cfgRes.config.engine.kind !== 'openai-compat') {
    fail(`daemon engine = ${cfgRes.config.engine.kind}, expected openai-compat`);
  }
  log('daemon engine = openai-compat ✓');

  // Run the full session flow
  await fetchJson(`${DAEMON_URL}/api/session/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ demoPath: demoDir }),
  });
  log('session started');

  const det = await fetchJson(`${DAEMON_URL}/api/detector/run`, { method: 'POST' });
  if (det.type !== 'cli-tool') fail(`detector: ${det.type}`);
  log('detector via openai-compat:', det.type);

  await fetchJson(`${DAEMON_URL}/api/preset/choose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'cli-tool' }),
  });
  log('preset chosen');

  const vision = await fetchJson(`${DAEMON_URL}/api/vision/round`);
  if (!vision.done) fail('expected vision finalized in 1 round');
  log('vision done via openai-compat');

  await fetchJson(`${DAEMON_URL}/api/loop/start`, { method: 'POST' });
  log('loop started');

  const final = await pollFor(
    `${DAEMON_URL}/api/session/current`,
    (s) => s?.session?.status === 'DONE' || s?.session?.status === 'PAUSED',
    180_000,
  );
  log('final status:', final.session.status);

  if (final.session.status !== 'DONE') {
    const events = await fetchJson(`${DAEMON_URL}/api/log/events?limit=200`);
    for (const e of events.events.slice(-30)) {
      console.log(`[event] ${e.kind} ${JSON.stringify(e.payload).slice(0, 200)}`);
    }
    fail(`session did not reach DONE (got ${final.session.status})`);
  }

  const events = await fetchJson(`${DAEMON_URL}/api/log/events?limit=500`);
  const mergedEvents = events.events.filter((e) => e.kind === 'MERGED');
  if (mergedEvents.length < 1) fail('expected at least 1 MERGED event');
  log('MERGED via openai-compat:', mergedEvents.length, 'sha:', mergedEvents[0].payload.mergeSha);

  const gitLog = spawnSync('git', ['log', '--oneline'], { cwd: demoDir, encoding: 'utf8' });
  log('demo git log:\n' + gitLog.stdout.trim());

  log('PASS — openai-compat engine drove the full loop end-to-end.');
  daemon.kill('SIGTERM');
  stub.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke-engines] crashed:', e.stack ?? e.message ?? e);
  process.exit(1);
});

// Silence the unused-import linter while keeping the import for cross-platform parity.
void existsSync;
