// F5 — Skills as agent prompt unit.
//
// Borrows Anthropic's Skills format (frontmatter name+description+metadata,
// markdown body). Each d2p agent role can ship a default SKILL.md; users can
// drop `<demo>/.d2p/skills/<role>.md` to override or extend per-project. The
// loader resolves project-skill > daemon-skill > built-in-default and returns
// the body for prompt injection.
//
// Today d2p's prompts live as TypeScript string literals (daemon/src/prompts/).
// Skills make those prompts a versioned, shareable artifact AND open a clean
// extension path for users who want to add domain knowledge ("for python
// projects always run mypy in strict mode") without writing TypeScript.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import type { ClaudeRole } from '../types.js';

const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/, 'name must be lower-kebab'),
  description: z.string().min(1),
  /** Which agent role this skill applies to. */
  role: z.string().min(1),
});

export interface SkillFrontmatter {
  name: string;
  description: string;
  role: string;
}

export interface Skill {
  frontmatter: SkillFrontmatter;
  body: string;
  /** Where the skill was loaded from — informational for the UI. */
  source: 'project' | 'daemon' | 'default';
  /** Absolute path the body was read from (null when source==='default'). */
  filePath: string | null;
}

/** Parse a single .md file into a Skill, or return null when invalid. */
async function parseSkillFile(
  filePath: string,
  source: Skill['source'],
): Promise<Skill | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = matter(raw);
    const fm = SkillFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) return null;
    return { frontmatter: fm.data, body: parsed.content.trim(), source, filePath };
  } catch {
    return null;
  }
}

/** Find a skill for the given role, looking in:
 *    1. <demoPath>/.d2p/skills/<role>.md  (project override)
 *    2. <daemonRoot>/skills/<role>.md      (daemon-shipped default)
 *  Returns null if none found — caller falls back to its built-in TS prompt. */
export async function loadSkillForRole(
  role: ClaudeRole,
  demoPath: string | null,
  daemonSkillsDir: string,
): Promise<Skill | null> {
  if (demoPath) {
    const project = path.join(demoPath, '.d2p', 'skills', `${role}.md`);
    const s = await parseSkillFile(project, 'project');
    if (s) return s;
  }
  const daemon = path.join(daemonSkillsDir, `${role}.md`);
  return parseSkillFile(daemon, 'daemon');
}

/** List ALL skills the project has on disk (project + daemon). Used by the
 *  Settings UI panel so the user can see what's active. */
export async function listActiveSkills(
  demoPath: string | null,
  daemonSkillsDir: string,
): Promise<Skill[]> {
  const out: Skill[] = [];
  const seenRoles = new Set<string>();

  if (demoPath) {
    const projectDir = path.join(demoPath, '.d2p', 'skills');
    for (const s of await readSkillsFromDir(projectDir, 'project')) {
      out.push(s);
      seenRoles.add(s.frontmatter.role);
    }
  }
  for (const s of await readSkillsFromDir(daemonSkillsDir, 'daemon')) {
    if (!seenRoles.has(s.frontmatter.role)) {
      out.push(s);
      seenRoles.add(s.frontmatter.role);
    }
  }
  return out;
}

async function readSkillsFromDir(dir: string, source: Skill['source']): Promise<Skill[]> {
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) return [];
  } catch {
    return [];
  }
  const files = await readdir(dir);
  const skills: Skill[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const s = await parseSkillFile(path.join(dir, f), source);
    if (s) skills.push(s);
  }
  return skills;
}
