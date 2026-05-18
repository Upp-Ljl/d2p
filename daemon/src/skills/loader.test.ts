import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadSkillForRole, listActiveSkills } from './loader.js';

async function newScratch() {
  const demo = await mkdtemp(path.join(os.tmpdir(), 'd2p-skill-demo-'));
  const daemon = await mkdtemp(path.join(os.tmpdir(), 'd2p-skill-daemon-'));
  return { demo, daemon };
}

async function writeSkill(file: string, name: string, role: string, body: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    ['---', `name: ${name}`, `description: ${name} skill`, `role: ${role}`, '---', '', body].join('\n'),
  );
}

describe('loadSkillForRole', () => {
  it('falls back to daemon default when no project skill', async () => {
    const { demo, daemon } = await newScratch();
    await writeSkill(path.join(daemon, 'differ.md'), 'differ', 'differ', 'default body');
    const s = await loadSkillForRole('differ', demo, daemon);
    expect(s?.source).toBe('daemon');
    expect(s?.body).toBe('default body');
    await rm(demo, { recursive: true, force: true });
    await rm(daemon, { recursive: true, force: true });
  });

  it('project skill overrides daemon default', async () => {
    const { demo, daemon } = await newScratch();
    await writeSkill(path.join(daemon, 'differ.md'), 'differ', 'differ', 'default body');
    await writeSkill(
      path.join(demo, '.d2p', 'skills', 'differ.md'),
      'project-differ',
      'differ',
      'project override body',
    );
    const s = await loadSkillForRole('differ', demo, daemon);
    expect(s?.source).toBe('project');
    expect(s?.body).toBe('project override body');
    await rm(demo, { recursive: true, force: true });
    await rm(daemon, { recursive: true, force: true });
  });

  it('returns null when neither exists', async () => {
    const { demo, daemon } = await newScratch();
    expect(await loadSkillForRole('alignment', demo, daemon)).toBeNull();
    await rm(demo, { recursive: true, force: true });
    await rm(daemon, { recursive: true, force: true });
  });

  it('rejects malformed frontmatter', async () => {
    const { demo, daemon } = await newScratch();
    await writeFile(
      path.join(daemon, 'differ.md'),
      ['---', 'no-name-field: true', '---', '', 'body'].join('\n'),
    );
    expect(await loadSkillForRole('differ', null, daemon)).toBeNull();
    await rm(demo, { recursive: true, force: true });
    await rm(daemon, { recursive: true, force: true });
  });
});

describe('listActiveSkills', () => {
  it('merges project + daemon and prefers project on conflict', async () => {
    const { demo, daemon } = await newScratch();
    await writeSkill(path.join(daemon, 'differ.md'), 'differ', 'differ', 'daemon');
    await writeSkill(path.join(daemon, 'alignment.md'), 'alignment', 'alignment', 'daemon');
    await writeSkill(
      path.join(demo, '.d2p', 'skills', 'differ.md'),
      'project-differ',
      'differ',
      'project',
    );
    const all = await listActiveSkills(demo, daemon);
    expect(all.length).toBe(2);
    const differ = all.find((s) => s.frontmatter.role === 'differ');
    expect(differ?.source).toBe('project');
    const align = all.find((s) => s.frontmatter.role === 'alignment');
    expect(align?.source).toBe('daemon');
    await rm(demo, { recursive: true, force: true });
    await rm(daemon, { recursive: true, force: true });
  });

  it('handles missing dirs gracefully', async () => {
    const all = await listActiveSkills('/totally/nonexistent', '/also/nonexistent');
    expect(all).toEqual([]);
  });
});
