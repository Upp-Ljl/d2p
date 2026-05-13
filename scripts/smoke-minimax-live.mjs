#!/usr/bin/env node
// LIVE smoke against the real MiniMax API. Uses a real key, real network,
// real MiniMax-M2.7-highspeed. Runs against fixtures/demo-cli (tiny).
//
// Expected cost: a handful of calls (detector / vision / repo-summary /
// differ / implementer / alignment / behavioral / done-check), all small
// prompts. Should be well under $0.10.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DAEMON_PORT = 5774;
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;
const KEY_FILE = process.env.D2P_MMM_KEY_FILE ?? 'D:/lll/cairn/.cairn-poc3-keys/mmmkey.txt';

const log = (...args) => console.log('[live-minimax]', ...args);
const fail = (msg) => {
  console.error(`[live-minimax] FAIL: ${msg}`);
  process.exit(1);
};

async function fetchJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${url}: ${await r.text()}`);
  return r.json();
}

async function pollFor(url, predicate, timeoutMs, intervalMs = 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const v = await fetchJson(url);
      if (predicate(v)) return v;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`polling ${url} timed out after ${timeoutMs}ms`);
}

async function main() {
  const apiKey = readFileSync(KEY_FILE, 'utf8').trim();
  if (!apiKey) fail('key file empty');

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'd2p-live-mmm-'));
  const demoDir = path.join(tmp, 'demo-cli');
  const dbPath = path.join(tmp, 'state.db');
  const configPath = path.join(tmp, 'config.json');
  log('tmp:', tmp);

  cpSync(path.join(repoRoot, 'fixtures', 'demo-cli'), demoDir, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: demoDir });
  spawnSync('git', ['add', '-A'], { cwd: demoDir });
  spawnSync(
    'git',
    ['-c', 'user.email=smoke@local', '-c', 'user.name=smoke', 'commit', '-q', '-m', 'chore: initial'],
    { cwd: demoDir },
  );

  mkdirSync(path.dirname(configPath), { recursive: true });
  const cfg = {
    engine: {
      kind: 'openai-compat',
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey,
      models: {
        haiku: 'MiniMax-M2.7-highspeed',
        sonnet: 'MiniMax-M2.7',
        opus: 'MiniMax-M2.7',
      },
    },
  };
  writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  log('starting daemon (engine=openai-compat → MiniMax)...');
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
    try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  await pollFor(`${DAEMON_URL}/api/health`, (h) => h?.daemonVersion, 30_000);
  log('daemon up');

  const cfgRes = await fetchJson(`${DAEMON_URL}/api/config`);
  if (cfgRes.config.engine.kind !== 'openai-compat') fail('engine not openai-compat');
  log('engine: openai-compat @', cfgRes.config.engine.baseUrl);

  await fetchJson(`${DAEMON_URL}/api/session/start`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ demoPath: demoDir }),
  });
  log('session started');

  const t1 = Date.now();
  const det = await fetchJson(`${DAEMON_URL}/api/detector/run`, { method: 'POST' });
  log(`detector (${Date.now() - t1}ms):`, det.type, `confidence=${det.confidence.toFixed(2)}`);
  log('evidence:', det.evidence.slice(0, 3).join(' / '));

  await fetchJson(`${DAEMON_URL}/api/preset/choose`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'cli-tool' }),
  });
  log('preset chosen');

  const t2 = Date.now();
  const vision1 = await fetchJson(`${DAEMON_URL}/api/vision/round`);
  log(`vision round 1 (${Date.now() - t2}ms): done=${vision1.done}`);
  if (!vision1.done) {
    log('  questions:', vision1.questions?.map((q) => q.question).join(' | '));
    // Auto-answer with the first option of each question to bypass interactive
    const answers = (vision1.questions ?? []).map((q) => ({
      questionId: q.id,
      question: q.question,
      answer: q.options[0]?.label ?? '',
    }));
    const vision2 = await fetchJson(`${DAEMON_URL}/api/vision/answer`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (!vision2.done) {
      log('  forcing finalize...');
      await fetchJson(`${DAEMON_URL}/api/vision/finalize`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      });
    }
  }

  log('starting loop (this is where real MiniMax calls hit the implementer / reviewers)...');
  await fetchJson(`${DAEMON_URL}/api/loop/start`, { method: 'POST' });

  // Poll periodically + dump latest event so we can see where it stalls.
  let lastEventId = 0;
  const stallCheck = setInterval(async () => {
    try {
      const ev = await fetchJson(`${DAEMON_URL}/api/log/events?limit=20`);
      const newEvents = ev.events.filter((e) => e.id > lastEventId);
      for (const e of newEvents) {
        console.log(`  [event] ${e.kind} ${JSON.stringify(e.payload).slice(0, 200)}`);
        lastEventId = e.id;
      }
    } catch { /* ignore */ }
  }, 5000);

  let final;
  try {
    final = await pollFor(
      `${DAEMON_URL}/api/session/current`,
      (s) => s?.session?.status === 'DONE' || s?.session?.status === 'PAUSED',
      900_000, 5000,
    );
  } finally {
    clearInterval(stallCheck);
  }
  log('final status:', final.session.status);

  const events = await fetchJson(`${DAEMON_URL}/api/log/events?limit=500`);
  const milestones = events.events.filter((e) =>
    ['GAP_PICKED', 'FIX_COMMITTED', 'STATIC_GATE_PASSED', 'ALIGNMENT_RESULT', 'REVIEW_VERDICT', 'MERGED', 'GAP_DONE', 'DONE_CHECK_RESULT', 'SESSION_DONE', 'LOOP_PAUSED', 'ERROR'].includes(e.kind),
  );
  log('milestone events:');
  for (const e of milestones) {
    console.log('  ', e.kind, JSON.stringify(e.payload).slice(0, 160));
  }
  log('total cost:', JSON.stringify(final.costTotals));

  if (final.session.status === 'DONE') {
    log('✅ PASS — MiniMax really drove the full d2p loop end-to-end.');
  } else {
    log(`⚠ session paused, not DONE — see milestones above. Reason in last LOOP_PAUSED event.`);
  }

  daemon.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  process.exit(final.session.status === 'DONE' ? 0 : 1);
}

main().catch((e) => {
  console.error('[live-minimax] crashed:', e.stack ?? e.message ?? e);
  process.exit(1);
});
