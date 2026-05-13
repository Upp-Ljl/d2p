import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { writeInput, listInputs, readAllInputsAsText } from './store.js';

async function tmp(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'd2p-inputs-test-'));
}

describe('inputs/store', () => {
  it('writes + lists inputs', async () => {
    const dir = await tmp();
    const r = await writeInput(dir, 'prd.md', '# Product\n\n要做啥');
    expect(r.ok).toBe(true);
    const inputs = await listInputs(dir);
    expect(inputs.map((i) => i.name)).toEqual(['prd.md']);
    expect(inputs[0]!.size).toBeGreaterThan(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects unsafe filenames', async () => {
    const dir = await tmp();
    const r = await writeInput(dir, '../../etc/passwd', 'x');
    expect(r.ok).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects oversized body', async () => {
    const dir = await tmp();
    const big = 'a'.repeat(100_000);
    const r = await writeInput(dir, 'big.txt', big);
    expect(r.ok).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it('readAllInputsAsText concatenates with file markers', async () => {
    const dir = await tmp();
    await writeInput(dir, 'a.md', 'first');
    await writeInput(dir, 'b.md', 'second');
    const text = await readAllInputsAsText(dir);
    expect(text).toContain('<input:a.md>');
    expect(text).toContain('first');
    expect(text).toContain('<input:b.md>');
    expect(text).toContain('second');
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty string when no inputs', async () => {
    const dir = await tmp();
    const text = await readAllInputsAsText(dir);
    expect(text).toBe('');
    await rm(dir, { recursive: true, force: true });
  });
});
