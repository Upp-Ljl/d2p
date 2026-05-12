import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.d2p',
  '.d2p-worktrees',
  'dist',
  'build',
  '.next',
  '.vite',
  'coverage',
  '__pycache__',
  '.venv',
  'target',
]);

export async function treeDump(root: string, maxDepth = 3): Promise<string> {
  const lines: string[] = [];
  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > maxDepth) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
      const rel = path.join(prefix, e.name);
      lines.push(e.isDirectory() ? `${rel}/` : rel);
      if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1, rel);
    }
  }
  await walk(root, 1, '');
  return lines.join('\n');
}

const MANIFEST_FILES = [
  'package.json',
  'tsconfig.json',
  'Cargo.toml',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'go.mod',
  'Gemfile',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'next.config.ts',
  'next.config.js',
  'vite.config.ts',
  'vite.config.js',
  'Dockerfile',
  'fly.toml',
  'vercel.json',
  'netlify.toml',
];

export async function readManifests(root: string): Promise<string> {
  const parts: string[] = [];
  let totalBytes = 0;
  const cap = 8 * 1024;
  for (const name of MANIFEST_FILES) {
    const p = path.join(root, name);
    try {
      const buf = await readFile(p, 'utf8');
      const head = buf.split(/\r?\n/).slice(0, 50).join('\n');
      const slice = head.slice(0, Math.max(0, cap - totalBytes));
      if (!slice) break;
      parts.push(`<file:${name}>\n${slice}\n</file>`);
      totalBytes += slice.length;
      if (totalBytes >= cap) break;
    } catch {
      // missing file is fine
    }
  }
  return parts.join('\n\n');
}

export async function readReadmeHead(root: string, maxLines = 100): Promise<string> {
  for (const name of ['README.md', 'README.MD', 'readme.md', 'README']) {
    const p = path.join(root, name);
    try {
      const buf = await readFile(p, 'utf8');
      return buf.split(/\r?\n/).slice(0, maxLines).join('\n');
    } catch {
      // continue
    }
  }
  return '';
}

export async function readFileHeads(root: string, files: string[], headLines = 100): Promise<string> {
  const parts: string[] = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    try {
      const s = await stat(abs);
      if (!s.isFile()) continue;
      const buf = await readFile(abs, 'utf8');
      const head = buf.split(/\r?\n/).slice(0, headLines).join('\n');
      parts.push(`<file:${rel}>\n${head}\n</file>`);
    } catch {
      // ignore
    }
  }
  return parts.join('\n\n');
}
