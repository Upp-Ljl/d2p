#!/usr/bin/env node
// End-to-end smoke for `github-pr` session mode.
//
// 1. Init a local bare git repo (file:// URL) as the "GitHub remote".
// 2. Start a stub HTTP server that pretends to be the GitHub REST API
//    (records POST /repos/.../pulls calls and returns a fake PR).
// 3. Start the d2p daemon (claude-cli engine + fake-claude shim) with
//    D2P_GITHUB_API_BASE pointing at the stub.
// 4. POST /api/config to set a fake GitHub token.
// 5. Start session on demo whose `origin` = file://bare-repo.
// 6. Switch session to github-pr mode via /api/github/configure-session.
// 7. Run the full loop. Assert:
//      a. fix/<slug> commit appears in the bare repo
//      b. stub received POST /repos/test-owner/test-repo/pulls
//      c. session reaches DONE; MERGED event payload includes prNumber + prUrl

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DAEMON_PORT = 5574;
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;
const FAKE_CLAUDE = path.join(__dirname, 'fake-claude.mjs');
const OWNER = 'test-owner';
const REPO = 'test-repo';

const log = (...args) => console.log('[smoke-github-pr]', ...args);
const fail = (msg) => {
  console.error(`[smoke-github-pr] FAIL: ${msg}`);
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
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`polling ${url} timed out after ${timeoutMs}ms`);
}

function startStubGitHub(state) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let bodyJson = null;
        try { bodyJson = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }
        state.requests.push({
          method: req.method,
          url: req.url,
          authHeader: req.headers.authorization,
          bodyJson,
        });

        const m = /^\/repos\/([^/]+)\/([^/]+)\/pulls$/.exec(req.url ?? '');
        if (m && req.method === 'POST') {
          state.lastPRNumber++;
          const owner = m[1];
          const repo = m[2];
          const prNumber = state.lastPRNumber;
          const respBody = {
            number: prNumber,
            html_url: `http://stub-github/${owner}/${repo}/pull/${prNumber}`,
            url: `http://localhost/repos/${owner}/${repo}/pulls/${prNumber}`,
            state: 'open',
          };
          res.statusCode = 201;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(respBody));
          return;
        }
        if (req.method === 'GET' && req.url === '/user') {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ login: 'test-user' }));
          return;
        }
        res.statusCode = 404;
        res.end('not found');
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'd2p-smoke-pr-'));
  const demoDir = path.join(tmp, 'demo-cli');
  const bareRepo = path.join(tmp, 'remote.git');
  const dbPath = path.join(tmp, 'state.db');
  const configPath = path.join(tmp, 'config.json');
  log('tmp:', tmp);

  // 1. Bare repo (stands in for GitHub repo on disk)
  spawnSync('git', ['init', '--bare', '-b', 'main', bareRepo]);
  log('bare repo at', bareRepo);

  // 2. Demo with origin pointing at the bare repo (file://)
  cpSync(path.join(repoRoot, 'fixtures', 'demo-cli'), demoDir, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: demoDir });
  spawnSync('git', ['add', '-A'], { cwd: demoDir });
  spawnSync(
    'git',
    ['-c', 'user.email=smoke@local', '-c', 'user.name=smoke', 'commit', '-q', '-m', 'chore: initial smoke commit'],
    { cwd: demoDir },
  );
  // file:// URL; Windows + POSIX both accept three-slash absolute form
  const bareUrl = 'file:///' + bareRepo.replace(/\\/g, '/').replace(/^\//, '');
  spawnSync('git', ['remote', 'add', 'origin', bareUrl], { cwd: demoDir });
  spawnSync('git', ['push', '-u', 'origin', 'main'], { cwd: demoDir });
  log('demo origin =', bareUrl);

  // 3. Stub GitHub API
  const apiState = { requests: [], lastPRNumber: 0 };
  const apiServer = await startStubGitHub(apiState);
  const apiAddr = apiServer.address();
  const apiUrl = `http://127.0.0.1:${apiAddr.port}`;
  log('stub GitHub API at', apiUrl);

  // 4. Minimal config: still claude-cli for the LLM side (test isolates github
  //    layer; engine is already covered by smoke-engines.mjs). github.token
  //    can be any string — pushFixBranch sees a non-github origin so it
  //    won't inject the PAT into the URL.
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        engine: { kind: 'claude-cli' },
        github: { token: 'ghp_smoke_irrelevant', baseBranch: 'main' },
      },
      null,
      2,
    ),
  );

  // 5. Spawn daemon
  const daemon = spawn(
    process.execPath,
    [path.join(repoRoot, 'daemon', 'dist', 'server.js')],
    {
      env: {
        ...process.env,
        D2P_DAEMON_PORT: String(DAEMON_PORT),
        D2P_DB_PATH: dbPath,
        D2P_CONFIG_PATH: configPath,
        D2P_CLAUDE_BIN: FAKE_CLAUDE,
        D2P_GITHUB_API_BASE: apiUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  daemon.stdout.on('data', (b) => process.stdout.write(`[daemon] ${b}`));
  daemon.stderr.on('data', (b) => process.stderr.write(`[daemon-err] ${b}`));

  const cleanup = () => {
    try { daemon.kill('SIGTERM'); } catch { /* ignore */ }
    try { apiServer.close(); } catch { /* ignore */ }
    try { rmSync(tmp, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  // 6. Wait for daemon
  await pollFor(`${DAEMON_URL}/api/health`, (h) => h?.daemonVersion, 30_000);
  log('daemon up');

  // 7. Start session
  await fetchJson(`${DAEMON_URL}/api/session/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ demoPath: demoDir }),
  });
  await fetchJson(`${DAEMON_URL}/api/detector/run`, { method: 'POST' });
  await fetchJson(`${DAEMON_URL}/api/preset/choose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'cli-tool' }),
  });
  const visionRes = await fetchJson(`${DAEMON_URL}/api/vision/round`);
  if (!visionRes.done) fail('vision did not finalize in round 1');

  // 8. Switch session to github-pr mode (origin is file://, so we must pass repo explicitly)
  const ghRes = await fetchJson(`${DAEMON_URL}/api/github/configure-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo: `${OWNER}/${REPO}`, baseBranch: 'main' }),
  });
  if (ghRes.mode !== 'github-pr') fail(`expected mode github-pr, got ${ghRes.mode}`);
  log('session switched to github-pr mode');

  // 9. Run loop
  await fetchJson(`${DAEMON_URL}/api/loop/start`, { method: 'POST' });
  const final = await pollFor(
    `${DAEMON_URL}/api/session/current`,
    (s) => s?.session?.status === 'DONE' || s?.session?.status === 'PAUSED',
    180_000,
  );
  log('final status:', final.session.status);

  // 10. Assertions
  if (final.session.status !== 'DONE') {
    const events = await fetchJson(`${DAEMON_URL}/api/log/events?limit=200`);
    for (const e of events.events.slice(-30)) {
      console.log(`[event] ${e.kind} ${JSON.stringify(e.payload).slice(0, 200)}`);
    }
    fail(`session did not reach DONE (got ${final.session.status})`);
  }

  // 10a. bare repo received fix/add-version-flag branch
  const bareRefs = spawnSync('git', ['--git-dir', bareRepo, 'branch', '--list', 'fix/add-version-flag'], {
    encoding: 'utf8',
  });
  if (!bareRefs.stdout.includes('fix/add-version-flag')) {
    fail(`bare repo missing fix branch:\n${bareRefs.stdout || bareRefs.stderr}`);
  }
  log('bare repo has fix/add-version-flag ✓');

  // 10b. stub received a POST to /repos/owner/repo/pulls
  const prPosts = apiState.requests.filter(
    (r) => r.method === 'POST' && r.url === `/repos/${OWNER}/${REPO}/pulls`,
  );
  if (prPosts.length < 1) {
    fail(`stub got no POST /repos/${OWNER}/${REPO}/pulls; got: ${JSON.stringify(apiState.requests)}`);
  }
  const pr = prPosts[0];
  if (pr.authHeader !== 'token ghp_smoke_irrelevant') {
    fail(`PR request missing token header: ${pr.authHeader}`);
  }
  if (!pr.bodyJson?.head?.startsWith('fix/')) fail(`PR body bad head: ${JSON.stringify(pr.bodyJson)}`);
  if (pr.bodyJson?.base !== 'main') fail(`PR body bad base: ${pr.bodyJson?.base}`);
  log('stub GitHub API received POST /pulls with correct headers + body ✓');

  // 10c. MERGED event payload includes prNumber + prUrl
  const events = await fetchJson(`${DAEMON_URL}/api/log/events?limit=500`);
  const mergedEvent = events.events.find((e) => e.kind === 'MERGED');
  if (!mergedEvent) fail('no MERGED event');
  if (mergedEvent.payload.mode !== 'github-pr') fail(`MERGED mode = ${mergedEvent.payload.mode}`);
  if (typeof mergedEvent.payload.prNumber !== 'number') fail('MERGED missing prNumber');
  if (!mergedEvent.payload.prUrl) fail('MERGED missing prUrl');
  log('MERGED event includes PR #' + mergedEvent.payload.prNumber + ' @ ' + mergedEvent.payload.prUrl);

  log('PASS — github-pr session mode pushed branch + opened PR end-to-end.');
  daemon.kill('SIGTERM');
  apiServer.close();
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke-github-pr] crashed:', e.stack ?? e.message ?? e);
  process.exit(1);
});
