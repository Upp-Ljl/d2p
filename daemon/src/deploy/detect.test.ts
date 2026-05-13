import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectDeployTargets } from './detect.js';

async function tmp(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'd2p-deploy-test-'));
}

describe('detectDeployTargets', () => {
  it('returns empty for a bare directory', async () => {
    const dir = await tmp();
    const targets = await detectDeployTargets(dir);
    expect(targets).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it('detects Vercel via vercel.json', async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, 'vercel.json'), '{}');
    const targets = await detectDeployTargets(dir);
    expect(targets.map((t) => t.id)).toContain('vercel');
    await rm(dir, { recursive: true, force: true });
  });

  it('detects Fly via fly.toml', async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, 'fly.toml'), 'app = "demo"');
    const targets = await detectDeployTargets(dir);
    expect(targets.map((t) => t.id)).toContain('fly');
    await rm(dir, { recursive: true, force: true });
  });

  it('detects Docker via Dockerfile', async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, 'Dockerfile'), 'FROM node:24');
    const targets = await detectDeployTargets(dir);
    expect(targets.map((t) => t.id)).toContain('docker');
    await rm(dir, { recursive: true, force: true });
  });

  it('detects npm publish via prepublishOnly script', async () => {
    const dir = await tmp();
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: { prepublishOnly: 'tsc' } }),
    );
    const targets = await detectDeployTargets(dir);
    expect(targets.map((t) => t.id)).toContain('npm');
    await rm(dir, { recursive: true, force: true });
  });

  it('sorts by confidence descending', async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, 'vercel.json'), '{}');
    await writeFile(path.join(dir, 'next.config.js'), '');
    await writeFile(path.join(dir, 'Dockerfile'), '');
    const targets = await detectDeployTargets(dir);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i - 1]!.confidence).toBeGreaterThanOrEqual(targets[i]!.confidence);
    }
    await rm(dir, { recursive: true, force: true });
  });
});
