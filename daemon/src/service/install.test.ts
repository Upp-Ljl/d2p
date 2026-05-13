import { describe, it, expect } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { generateInstaller } from './install.js';

describe('generateInstaller', () => {
  it('produces a Windows .cmd installer with sc create line', async () => {
    const a = await generateInstaller('win32');
    expect(a.platform).toBe('win32');
    expect(a.files.length).toBeGreaterThanOrEqual(2);
    const install = a.files.find((f) => f.path.endsWith('install.cmd'));
    expect(install).toBeDefined();
    const contents = await readFile(install!.path, 'utf8');
    expect(contents).toContain('sc create d2p-daemon');
    expect(contents).toContain('start= auto');
    expect(a.nextSteps.some((s) => /administrator/i.test(s))).toBe(true);
  });

  it('produces a macOS .plist with launchd label', async () => {
    const a = await generateInstaller('darwin');
    expect(a.platform).toBe('darwin');
    const plist = a.files[0]!;
    expect(plist.path).toMatch(/\.plist$/);
    const contents = await readFile(plist.path, 'utf8');
    expect(contents).toContain('local.d2p-daemon');
    expect(contents).toContain('<key>RunAtLoad</key>');
    expect(a.nextSteps.some((s) => s.includes('launchctl bootstrap'))).toBe(true);
  });

  it('produces a systemd .service unit', async () => {
    const a = await generateInstaller('linux');
    expect(a.platform).toBe('linux');
    const unit = a.files[0]!;
    expect(unit.path).toMatch(/d2p-daemon\.service$/);
    const contents = await readFile(unit.path, 'utf8');
    expect(contents).toContain('[Unit]');
    expect(contents).toContain('[Service]');
    expect(contents).toContain('[Install]');
    expect(contents).toContain('ExecStart=');
    expect(contents).toContain('WantedBy=default.target');
    const s = await stat(unit.path);
    expect(s.isFile()).toBe(true);
    expect(a.nextSteps.some((s) => s.includes('systemctl --user'))).toBe(true);
  });
});
