import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type {
  PresetFrontmatter,
  PresetOverrides,
  ProjectType,
  PresetStatusItem,
  GapCategory,
} from '../types.js';
import { ALL_GAP_CATEGORIES } from '../types.js';

const PresetFrontmatterSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  inherits: z.array(z.string()).optional(),
  high_sensitivity_categories: z
    .array(z.enum(ALL_GAP_CATEGORIES as unknown as [GapCategory, ...GapCategory[]]))
    .optional(),
});

const PresetOverridesSchema = z.object({
  add: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
        category: z.enum(ALL_GAP_CATEGORIES as unknown as [GapCategory, ...GapCategory[]]),
        description: z.string().min(1),
        severity: z.enum(['P1', 'P2', 'P3']),
      }),
    )
    .default([]),
  remove: z.array(z.string()).default([]),
  skip: z.array(z.string()).default([]),
});

export interface LoadedPreset {
  frontmatter: PresetFrontmatter;
  body: string;
  raw: string;
}

function defaultPresetsDir(): string {
  if (process.env.D2P_PRESETS_DIR) return process.env.D2P_PRESETS_DIR;
  // daemon/dist/preset/loader.js -> repo root presets/
  const here = path.dirname(fileURLToPath(import.meta.url));
  // try ../../../presets first (dist), then ../../presets (src)
  return path.resolve(here, '..', '..', '..', 'presets');
}

export async function listAvailablePresets(presetsDir = defaultPresetsDir()): Promise<string[]> {
  try {
    const files = await readdir(presetsDir);
    return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

export async function readPreset(
  type: ProjectType | string,
  presetsDir = defaultPresetsDir(),
): Promise<LoadedPreset> {
  const file = path.join(presetsDir, `${type}.md`);
  const raw = await readFile(file, 'utf8');
  const parsed = matter(raw);
  const fmResult = PresetFrontmatterSchema.safeParse(parsed.data);
  if (!fmResult.success) {
    throw new Error(`invalid preset frontmatter ${type}: ${fmResult.error.message}`);
  }
  return { frontmatter: fmResult.data as PresetFrontmatter, body: parsed.content, raw };
}

export async function readOverrides(demoPath: string): Promise<PresetOverrides> {
  const file = path.join(demoPath, '.d2p', 'preset-overrides.yaml');
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = parseYaml(raw);
    const result = PresetOverridesSchema.safeParse(parsed);
    if (!result.success) return { add: [], remove: [], skip: [] };
    return result.data as PresetOverrides;
  } catch {
    return { add: [], remove: [], skip: [] };
  }
}

/** Apply overrides to a list of preset_status items returned by the differ. */
export function applyOverridesToStatus(
  items: PresetStatusItem[],
  overrides: PresetOverrides,
): PresetStatusItem[] {
  return items
    .filter((it) => !overrides.remove.includes(it.item))
    .map((it) =>
      overrides.skip.includes(it.item) ? { ...it, status: 'done' as const, note: 'skipped by user' } : it,
    );
}
