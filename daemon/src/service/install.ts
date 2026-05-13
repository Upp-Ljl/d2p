// Generate platform-specific service installer scripts.
// Round-9 lock: "装为系统服务（systemd / launchd / Windows Service）".
//
// We DO NOT run anything privileged from d2p itself. We *emit* installer
// artifacts the user runs once, the user being responsible for the privilege
// step. The CLI subcommand `d2p install-service` calls into here, writes
// scripts to ~/.d2p/service/, and prints the next manual step.

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, chmod } from 'node:fs/promises';

export type Platform = 'win32' | 'darwin' | 'linux';

export interface InstallerArtifacts {
  platform: Platform;
  files: { path: string; mode?: number }[];
  nextSteps: string[];
}

function repoRoot(): string {
  // daemon/dist/service/install.js → ../../../
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function homeServiceDir(): string {
  return path.join(os.homedir(), '.d2p', 'service');
}

function nodePath(): string {
  return process.execPath;
}

const SERVICE_NAME = 'd2p-daemon';

export async function generateInstaller(platform: Platform = process.platform as Platform): Promise<InstallerArtifacts> {
  const dir = homeServiceDir();
  await mkdir(dir, { recursive: true });

  const root = repoRoot();
  const entry = path.join(root, 'daemon', 'dist', 'server.js');
  const node = nodePath();

  if (platform === 'win32') {
    // Windows: NSSM-style wrapper script + install.cmd that uses sc.exe to
    // create a service running `node.exe daemon/dist/server.js`.
    const wrapper = path.join(dir, 'd2p-daemon-wrapper.cmd');
    const install = path.join(dir, 'install.cmd');
    const uninstall = path.join(dir, 'uninstall.cmd');

    await writeFile(
      wrapper,
      `@echo off\r\nset D2P_DAEMON_PORT=${process.env.D2P_DAEMON_PORT ?? '5174'}\r\n"${node}" "${entry}"\r\n`,
      'utf8',
    );
    await writeFile(
      install,
      [
        '@echo off',
        'REM Run as Administrator.',
        `sc create ${SERVICE_NAME} binPath= "\\"${wrapper}\\"" start= auto DisplayName= "d2p daemon"`,
        `sc description ${SERVICE_NAME} "d2p — demo to product daemon"`,
        `sc start ${SERVICE_NAME}`,
      ].join('\r\n') + '\r\n',
      'utf8',
    );
    await writeFile(
      uninstall,
      [
        '@echo off',
        `sc stop ${SERVICE_NAME}`,
        `sc delete ${SERVICE_NAME}`,
      ].join('\r\n') + '\r\n',
      'utf8',
    );

    return {
      platform,
      files: [{ path: wrapper }, { path: install }, { path: uninstall }],
      nextSteps: [
        'Right-click PowerShell or cmd → "Run as administrator".',
        `Run: ${install}`,
        `Service "${SERVICE_NAME}" now starts on boot.`,
        `To uninstall: run ${uninstall} (also elevated).`,
      ],
    };
  }

  if (platform === 'darwin') {
    const plistPath = path.join(dir, `local.d2p-daemon.plist`);
    const plist =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
      `<plist version="1.0"><dict>\n` +
      `  <key>Label</key><string>local.d2p-daemon</string>\n` +
      `  <key>ProgramArguments</key>\n` +
      `  <array>\n    <string>${node}</string>\n    <string>${entry}</string>\n  </array>\n` +
      `  <key>EnvironmentVariables</key>\n  <dict>\n    <key>D2P_DAEMON_PORT</key><string>${process.env.D2P_DAEMON_PORT ?? '5174'}</string>\n  </dict>\n` +
      `  <key>RunAtLoad</key><true/>\n` +
      `  <key>KeepAlive</key><true/>\n` +
      `  <key>StandardOutPath</key><string>${path.join(os.homedir(), '.d2p', 'daemon.log')}</string>\n` +
      `  <key>StandardErrorPath</key><string>${path.join(os.homedir(), '.d2p', 'daemon.log')}</string>\n` +
      `</dict></plist>\n`;
    await writeFile(plistPath, plist, 'utf8');
    return {
      platform,
      files: [{ path: plistPath }],
      nextSteps: [
        `Copy: cp '${plistPath}' ~/Library/LaunchAgents/`,
        'Load:  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.d2p-daemon.plist',
        'Status: launchctl print gui/$(id -u)/local.d2p-daemon',
        'Unload: launchctl bootout gui/$(id -u)/local.d2p-daemon.plist',
      ],
    };
  }

  // linux — systemd user unit
  const unitPath = path.join(dir, 'd2p-daemon.service');
  const unit =
    `[Unit]\n` +
    `Description=d2p — demo to product daemon\n` +
    `After=network.target\n\n` +
    `[Service]\n` +
    `Type=simple\n` +
    `ExecStart=${node} ${entry}\n` +
    `Environment=D2P_DAEMON_PORT=${process.env.D2P_DAEMON_PORT ?? '5174'}\n` +
    `Restart=on-failure\n` +
    `RestartSec=3\n\n` +
    `[Install]\n` +
    `WantedBy=default.target\n`;
  await writeFile(unitPath, unit, 'utf8');
  await chmod(unitPath, 0o644);
  return {
    platform,
    files: [{ path: unitPath }],
    nextSteps: [
      `mkdir -p ~/.config/systemd/user && cp '${unitPath}' ~/.config/systemd/user/`,
      'systemctl --user daemon-reload',
      'systemctl --user enable --now d2p-daemon',
      'systemctl --user status d2p-daemon',
      'Stop: systemctl --user disable --now d2p-daemon',
    ],
  };
}
