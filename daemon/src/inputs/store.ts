// Non-code inputs (PRD / mockup notes / API spec etc.) stored per-demo at
// <demo>/.d2p/inputs/. Loaded into vision elicit prompt + done-check context
// so the agent can use them as background material.

import path from 'node:path';
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';

const MAX_INPUT_BYTES = 64 * 1024;

export interface InputFile {
  name: string;
  size: number;
  modifiedAt: number;
}

function inputsDir(demoPath: string): string {
  return path.join(demoPath, '.d2p', 'inputs');
}

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

export async function listInputs(demoPath: string): Promise<InputFile[]> {
  try {
    const dir = inputsDir(demoPath);
    const entries = await readdir(dir);
    const out: InputFile[] = [];
    for (const name of entries) {
      const full = path.join(dir, name);
      const s = await stat(full);
      if (s.isFile()) {
        out.push({ name, size: s.size, modifiedAt: s.mtimeMs });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  } catch {
    return [];
  }
}

export async function writeInput(
  demoPath: string,
  name: string,
  body: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!SAFE_NAME.test(name)) {
    return { ok: false, error: `invalid name (allowed: ${SAFE_NAME.source})` };
  }
  if (body.length > MAX_INPUT_BYTES) {
    return { ok: false, error: `body too large (>${MAX_INPUT_BYTES} bytes)` };
  }
  const dir = inputsDir(demoPath);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, body, 'utf8');
  return { ok: true, path: file };
}

export async function readAllInputsAsText(demoPath: string): Promise<string> {
  const files = await listInputs(demoPath);
  if (files.length === 0) return '';
  const parts: string[] = [];
  let total = 0;
  const cap = 16 * 1024;
  for (const f of files) {
    const body = await readFile(path.join(inputsDir(demoPath), f.name), 'utf8').catch(() => '');
    const slice = body.slice(0, Math.max(0, cap - total));
    if (!slice) break;
    parts.push(`<input:${f.name}>\n${slice}\n</input>`);
    total += slice.length;
    if (total >= cap) break;
  }
  return parts.join('\n\n');
}
