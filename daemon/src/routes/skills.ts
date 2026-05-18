// F5 — surface the active skill set so the Settings UI can show "what
// prompts are augmenting agents right now, and where do they come from."

import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queries } from './session.js';
import { listActiveSkills, loadSkillForRole } from '../skills/loader.js';
import type { ClaudeRole } from '../types.js';

export const skillsRoutes = new Hono();

function defaultSkillsDir(): string {
  if (process.env.D2P_SKILLS_DIR) return process.env.D2P_SKILLS_DIR;
  // daemon/dist/routes/skills.js -> repo root skills/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', 'skills');
}

skillsRoutes.get('/list', async (c) => {
  const session = queries.getCurrentActiveSession();
  const demoPath = session ? queries.getDemo(session.demoId)?.path ?? null : null;
  const skills = await listActiveSkills(demoPath as string | null, defaultSkillsDir());
  return c.json({
    skills: skills.map((s) => ({
      name: s.frontmatter.name,
      description: s.frontmatter.description,
      role: s.frontmatter.role,
      source: s.source,
      filePath: s.filePath,
    })),
  });
});

skillsRoutes.get('/role/:role', async (c) => {
  const role = c.req.param('role') as ClaudeRole;
  const session = queries.getCurrentActiveSession();
  const demoPath = session ? queries.getDemo(session.demoId)?.path ?? null : null;
  const skill = await loadSkillForRole(role, demoPath as string | null, defaultSkillsDir());
  if (!skill) return c.json({ skill: null });
  return c.json({
    skill: {
      name: skill.frontmatter.name,
      description: skill.frontmatter.description,
      role: skill.frontmatter.role,
      source: skill.source,
      filePath: skill.filePath,
      body: skill.body,
    },
  });
});
