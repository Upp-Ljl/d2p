// E2E tests for the git-pro + 长程任务 preview routes.
// Verifies that each preview renders without JS errors and screenshots the result.
// Uses a direct Vite server (no daemon) since these are preview-only routes.

import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ui dir is one level up from tests-e2e
const uiDir = path.resolve(__dirname, '..');
// repo root: git-pro-ui worktree root  (D:/lll/d2p/.worktrees/git-pro-ui)
const repoRoot = path.resolve(uiDir, '..');
// main d2p root: worktrees/../.. = D:/lll/d2p/.worktrees/../.. = D:/lll/d2p
const mainRoot = path.resolve(repoRoot, '..', '..');

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      if (!addr || typeof addr !== 'object') return reject(new Error('no port'));
      const p = addr.port;
      srv.close(() => resolve(p));
    });
  });
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`waitForHttp(${url}) timed out after ${timeoutMs}ms`);
}

/** Minimal harness: only Vite (no daemon). Works for preview routes. */
interface MinimalHarness {
  uiUrl: string;
  teardown: () => Promise<void>;
}

async function startViteOnly(): Promise<MinimalHarness> {
  const uiPort = await freePort();
  // Use a fake daemon port (not actually started — preview routes don't call daemon)
  const fakeDaemonPort = await freePort();

  // vite lives in d2p root node_modules (hoisted monorepo style)
  const candidates = [
    path.join(mainRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(uiDir, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(path.resolve(mainRoot, '..', 'd2p'), 'node_modules', 'vite', 'bin', 'vite.js'),
  ];
  const actualViteBin = candidates.find(existsSync) ?? candidates[0]!

  const vite: ChildProcess = spawn(
    process.execPath,
    [actualViteBin, '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'],
    {
      cwd: uiDir,
      env: {
        ...process.env,
        D2P_DAEMON_PORT: String(fakeDaemonPort),
        D2P_UI_PORT: String(uiPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  vite.stdout?.on('data', (b) => process.stderr.write(`[vite] ${b}`));
  vite.stderr?.on('data', (b) => process.stderr.write(`[vite-err] ${b}`));

  await waitForHttp(`http://127.0.0.1:${uiPort}/`);

  return {
    uiUrl: `http://127.0.0.1:${uiPort}`,
    teardown: async () => {
      try { vite.kill('SIGTERM'); } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 300));
    },
  };
}

let h: MinimalHarness;

test.beforeAll(async () => {
  if (!existsSync('design-screenshots')) mkdirSync('design-screenshots', { recursive: true });
  h = await startViteOnly();
});

test.afterAll(async () => {
  if (h) await h.teardown();
});

test('?preview=git-pro/diff renders CommitDiffDrawer without error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${h.uiUrl}/?preview=git-pro/diff`);

  // Toolbar back-link always visible
  await expect(page.getByText('← all variants')).toBeVisible({ timeout: 10_000 });
  // The diff drawer should be present
  await expect(page.locator('[data-testid="commit-diff-drawer"]')).toBeVisible({ timeout: 10_000 });
  // The commit SHA should appear
  await expect(page.getByText(/4944fba/)).toBeVisible({ timeout: 5_000 });

  expect(errors, `JS errors on git-pro/diff: ${errors.join(', ')}`).toEqual([]);

  await page.screenshot({
    path: 'design-screenshots/preview-git-pro-diff.png',
    fullPage: true,
  });
});

test('?preview=git-pro/milestones renders MilestonesPanel without error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${h.uiUrl}/?preview=git-pro/milestones`);

  // Toolbar
  await expect(page.getByText('← all variants')).toBeVisible({ timeout: 10_000 });
  // Milestones panel should be in the DOM
  await expect(page.locator('[data-testid="milestones-panel"]')).toBeVisible({ timeout: 10_000 });
  // "Lobby" milestone should show
  await expect(page.getByText('Lobby')).toBeVisible({ timeout: 5_000 });
  // "Polish" (in-progress) should show
  await expect(page.getByText('Polish')).toBeVisible({ timeout: 5_000 });

  expect(errors, `JS errors on git-pro/milestones: ${errors.join(', ')}`).toEqual([]);

  await page.screenshot({
    path: 'design-screenshots/preview-git-pro-milestones.png',
    fullPage: true,
  });
});
