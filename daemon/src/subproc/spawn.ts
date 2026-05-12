import { spawn } from 'node:child_process';

export interface SpawnOpts {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  spawnError: string | null;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

function appendCapped(buf: { text: string; remaining: number; truncated: boolean }, chunk: Buffer): void {
  if (buf.remaining <= 0) {
    buf.truncated = true;
    return;
  }
  const s = chunk.toString('utf8');
  if (s.length <= buf.remaining) {
    buf.text += s;
    buf.remaining -= s.length;
  } else {
    buf.text += s.slice(0, buf.remaining);
    buf.remaining = 0;
    buf.truncated = true;
  }
}

/**
 * Spawn a subprocess with timeout + buffer caps. Never rejects; failures land
 * in SpawnResult.spawnError or non-zero exitCode.
 */
export function runSubproc(opts: SpawnOpts): Promise<SpawnResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER;

  return new Promise<SpawnResult>((resolve) => {
    const started = Date.now();
    const stdoutBuf = { text: '', remaining: maxBuffer, truncated: false };
    const stderrBuf = { text: '', remaining: maxBuffer, truncated: false };

    // Special-cases:
    // - `.mjs`/`.cjs`/`.js` script paths: spawn `node` with the script, preserving
    //   each argv element (no shell parsing — long prompts with spaces survive).
    // - Windows `.cmd`/`.bat`: must go through cmd.exe; explicit invocation
    //   keeps shell:false and lets Node Win32-quote args correctly.
    let resolvedCmd = opts.cmd;
    let resolvedArgs = opts.args;
    if (/\.(mjs|cjs|js)$/i.test(opts.cmd)) {
      resolvedCmd = process.execPath;
      resolvedArgs = [opts.cmd, ...opts.args];
    } else if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(opts.cmd)) {
      resolvedCmd = process.env.ComSpec ?? 'cmd.exe';
      resolvedArgs = ['/d', '/s', '/c', opts.cmd, ...opts.args];
    }

    let child;
    try {
      child = spawn(resolvedCmd, resolvedArgs, {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        shell: false,
        windowsHide: true,
      });
    } catch (e) {
      resolve({
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: '',
        durationMs: Date.now() - started,
        timedOut: false,
        spawnError: (e as Error).message,
      });
      return;
    }

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 2000);
    }, timeoutMs);

    child.stdout?.on('data', (b: Buffer) => appendCapped(stdoutBuf, b));
    child.stderr?.on('data', (b: Buffer) => appendCapped(stderrBuf, b));

    if (opts.stdin !== undefined && child.stdin) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    }

    let spawnError: string | null = null;
    child.on('error', (e) => {
      spawnError = e.message;
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const truncMarker = (b: typeof stdoutBuf): string =>
        b.truncated ? b.text + `\n[...truncated]` : b.text;
      resolve({
        exitCode: code,
        signal,
        stdout: truncMarker(stdoutBuf),
        stderr: truncMarker(stderrBuf),
        durationMs: Date.now() - started,
        timedOut,
        spawnError,
      });
    });
  });
}
