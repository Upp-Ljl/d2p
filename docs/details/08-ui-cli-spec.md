# 08 — UI + CLI Spec

## Part 1: Web UI

### Stack

- Vite + React 18 + TypeScript（strict）
- Tailwind CSS + shadcn/ui（按需复制源码，不依赖运行时 lib）
- Zustand 状态管理
- `eventsource` polyfill 不需要（现代浏览器原生）

### File layout

```
ui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── tailwind.config.ts
└── src/
    ├── main.tsx                  # ReactDOM render
    ├── App.tsx                   # router
    ├── api.ts                    # daemon REST + SSE client
    ├── store.ts                  # Zustand global store
    ├── pages/
    │   ├── Landing.tsx
    │   ├── Setup.tsx
    │   ├── Workspace.tsx
    │   └── Done.tsx
    ├── components/
    │   ├── GapList.tsx
    │   ├── GapItem.tsx
    │   ├── RunLog.tsx
    │   ├── RunLogEvent.tsx
    │   ├── PresetProgressBar.tsx
    │   ├── VisionPanel.tsx
    │   ├── CostBadge.tsx
    │   ├── HealthBadge.tsx
    │   ├── PauseResumeButton.tsx
    │   ├── ConfirmDialog.tsx
    │   └── ui/                   # shadcn primitives (Button, Card, etc.)
    └── lib/
        ├── relative-time.ts
        ├── path-display.ts
        └── format-tokens.ts
```

### Page wireframes

#### Landing.tsx

```
┌────────────────────────────────────────────────────────┐
│ d2p                                  [health: green]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│   把 demo 推到 product                                  │
│                                                        │
│   ┌──────────────────────────────────────────────┐    │
│   │  选 demo 文件夹                               │    │
│   │  D:\demos\my-saas                            │    │
│   │  [浏览...]                  [Start session]  │    │
│   └──────────────────────────────────────────────┘    │
│                                                        │
│   或 ← 继续未完工作                                    │
│   ┌──────────────────────────────────────────────┐    │
│   │ • my-saas (PAUSED, 12 / 38 gaps done)        │    │
│   │ • my-cli  (PAUSED, 3 / 15 gaps done)         │    │
│   └──────────────────────────────────────────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

行为：
- "浏览" → daemon 不能开 native dialog；MVP-0 用 text input，用户粘绝对路径
- MVP-1+ 通过 Electron 包装才有 native dialog；web 路径 stick
- 已存 session 列表用 GET /api/session/current（per demo）拼

#### Setup.tsx

三段竖向：

```
┌────────────────────────────────────────────────────────┐
│ d2p / my-saas-demo                       [End session] │
├────────────────────────────────────────────────────────┤
│  Step 1 — Project type                      [edit]     │
│  ┌──────────────────────────────────────────────┐     │
│  │ SaaS Web Application (confidence: 0.84)      │     │
│  │ evidence:                                     │     │
│  │  • next.config.ts present                    │     │
│  │  • stripe in package.json                    │     │
│  │  • src/app/page.tsx exists                   │     │
│  │ [confirm] [change type ▼]                    │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  Step 2 — Vision elicit                    Round 2/5  │
│  ┌──────────────────────────────────────────────┐     │
│  │ Q: 你打算怎么收费？                            │     │
│  │ ○ 免费 + 增值                                 │     │
│  │ ○ 订阅 (Recommended)                         │     │
│  │ ○ 一次性买断                                  │     │
│  │ ○ 其他 (填空)                                 │     │
│  │                                              │     │
│  │ Q: ...                                       │     │
│  │                                              │     │
│  │ [skip remaining rounds — finalize now]       │     │
│  │ [submit answers]                             │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  Step 3 — Preset preview                    [adjust]   │
│  ┌──────────────────────────────────────────────┐     │
│  │ saas-web preset, 32 items                    │     │
│  │ + 1 custom add  - 0 remove  ⏭ 1 skip         │     │
│  │ [edit overrides...]  [confirm and go →]     │     │
│  └──────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

行为：
- Step 1 在 session_start 后自动跑 detector
- Step 2 单步推进，submit 后切下一轮 question
- Step 3 在 vision finalize 后才解锁；点 "edit overrides" 弹 modal 编辑 yaml
- "confirm and go" → POST /api/loop/start → 切到 Workspace.tsx

#### Workspace.tsx

三栏布局：

```
┌────────────────────────────────────────────────────────────────────────┐
│ d2p / my-saas-demo · LOOPING · 🟢                          [End ↪]      │
├──────────────┬─────────────────────────────────────┬───────────────────┤
│ Gap Queue    │ Live Run Log                        │ Vision & Preset   │
│              │                                     │                   │
│ ▶ in-progress│ 14:23  GAP_PICKED auth-signup      │ Vision summary    │
│   ▸ auth-    │ 14:23  WORKTREE_CREATED            │ ┌───────────────┐ │
│     signup   │ 14:23  AGENT_START implementer 1   │ │ # 产品定位    │ │
│              │ 14:24    thought: 看 src/auth dir  │ │ ...           │ │
│ pending (8)  │ 14:24  AGENT_END implementer 1     │ │               │ │
│ • auth-login │ 14:24  FIX_COMMITTED abc123        │ │ ## 目标用户   │ │
│ • tests-     │ 14:24  STATIC_GATE_PASSED          │ │ ...           │ │
│   smoke      │ 14:25  ALIGNMENT_RESULT 0.84       │ └───────────────┘ │
│ • err-       │ 14:25  AGENT_START behavioral      │ [open vision.md]  │
│   handler    │ 14:26  REVIEW_VERDICT APPROVE      │                   │
│ • ...        │ 14:26  MERGED                       │ Preset progress   │
│              │ 14:26  GAP_DONE auth-signup ✓      │ ████████░░ 22/30  │
│ done (12)    │ 14:26  DIFF_PRODUCED 3 new gaps    │                   │
│ skipped (1)  │                                     │ Cost              │
│ need-human(2)│                                     │ 12.4M in / 0.8M out│
│              │                                     │ ≈ $48.20          │
│              │                                     │                   │
│ [filter ▼]   │ [pause filter ▼] [export]          │                   │
│              │ [Pause ⏸]                           │                   │
└──────────────┴─────────────────────────────────────┴───────────────────┘
```

组件：
- `GapList` 左栏；按 status 分组；in-progress 高亮；点 gap 弹 GapDetailDrawer
- `RunLog` 中栏；倒序流入（最新在底）；每条 RunLogEvent；event kind 决定 icon + 颜色
- `RunLogEvent.tsx` 可折叠：折叠状态显示 ts + kind + 单行 summary；展开显示完整 payload + raw JSON
- `VisionPanel` 显 vision.md 渲染（marked）
- `PresetProgressBar` 数 status === done / total
- `CostBadge` 实时累计；点开看 per-role 拆分
- `PauseResumeButton` 根据 session.status 切换
- `HealthBadge` 顶栏；轮询 /api/health 10s 一次；红色显 doctor 详情

#### Done.tsx

```
┌────────────────────────────────────────────────────────┐
│ ✅ my-saas-demo is product-ready                        │
├────────────────────────────────────────────────────────┤
│ Summary                                                 │
│ • 28 gaps closed                                        │
│ • 47 commits over 3h 12min                              │
│ • 6 NEED_HUMAN flagged (see below)                      │
│ • Cost ≈ $128.40                                        │
│                                                         │
│ Vision satisfied:                                       │
│ > "用户能注册 / 登录 / 订阅 / 看到主面板..." (full)     │
│                                                         │
│ NEED_HUMAN gaps:                                        │
│  ⚠ db-migration-prod-strategy (ARCHITECTURAL)          │
│  ⚠ payment-webhook-retry (TOO_HARD)                    │
│  ...                                                    │
│                                                         │
│ [open session-summary.md] [start new session] [close]  │
└────────────────────────────────────────────────────────┘
```

### Zustand store

```ts
// ui/src/store.ts
interface D2pStore {
  // session
  session: Session | null;
  demo: Demo | null;
  presetStatus: PresetStatusItem[];
  costTotals: {inputTokens: number; outputTokens: number; estimatedUsd: number};

  // vision elicit
  visionRound: {done: boolean; roundIndex?: number; questions?: VisionQuestion[]; visionMd?: string} | null;

  // gaps
  gaps: Gap[];

  // log
  events: LogEvent[];               // ring buffer last 500 in memory
  sseConnected: boolean;

  // health
  health: HealthResponse | null;

  // actions
  refreshSession: () => Promise<void>;
  refreshGaps: () => Promise<void>;
  pushEvent: (e: LogEvent) => void;
  setSseConnected: (b: boolean) => void;
  ...
}
```

SSE 接管模式：
- App.tsx 挂载时 `openLogStream(onEvent)`；store.pushEvent + 触发 refreshGaps（节流 500ms）
- 收到 `MERGED` / `GAP_DONE` / `DONE_CHECK_RESULT` → refreshSession + refreshGaps

### Tailwind 调色板

```
brand:    #2563eb (blue-600) — primary actions
success:  #16a34a (green-600)
warning:  #d97706 (amber-600)
danger:   #dc2626 (red-600)
bg-canvas: #f8fafc (slate-50)
```

无 dark mode in MVP-0。

### i18n

- 默认中文；所有 UI 文案通过 `t(key)` 走 `ui/src/i18n/zh.ts`
- 英文（MVP-1+）：`ui/src/i18n/en.ts`，启动时浏览器 lang 检测

## Part 2: CLI

### Stack

- Node 24 + TypeScript
- `commander` for arg parsing
- Single bin: `bin/d2p`

### `cli/package.json`

```json
{
  "name": "@d2p/cli",
  "version": "0.1.0",
  "bin": { "d2p": "./bin/d2p" },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "commander": "^12.0.0"
  }
}
```

### `bin/d2p`

```sh
#!/usr/bin/env node
import('../dist/index.js').then(m => m.main(process.argv).catch(e => {
  console.error(e.stack ?? e.message);
  process.exit(1);
}));
```

### Commands

#### `d2p start [--no-open]`

启 daemon + UI。MVP-0 一体进程：

```ts
async function start(opts: {open: boolean}) {
  await ensureD2pDir();
  await checkClaude();         // warn but don't block
  await checkGit();
  // 已 daemon 在跑 → 不重复起
  if (await isDaemonAlive()) {
    console.log('daemon already running on :5174');
    if (opts.open) openBrowser('http://localhost:5173');
    return;
  }
  // spawn daemon + UI (Vite) 并 detach
  // 写 pid 到 ~/.d2p/daemon.pid
  // 30s 内 poll /api/health 看起来；起不来 print log path 退
  if (opts.open) openBrowser('http://localhost:5173');
}
```

#### `d2p stop`

```ts
async function stop() {
  const pid = await readDaemonPid();
  if (!pid) { console.log('no daemon running'); return; }
  process.kill(pid, 'SIGTERM');
  // wait up to 5s; if still alive, SIGKILL
  await removeDaemonPid();
  console.log('daemon stopped');
}
```

#### `d2p status`

```ts
async function status() {
  if (!await isDaemonAlive()) {
    console.log('daemon: not running');
    return;
  }
  const health = await fetch('http://localhost:5174/api/health').then(r => r.json());
  const session = await fetch('http://localhost:5174/api/session/current').then(r => r.json());
  console.log(JSON.stringify({ health, session }, null, 2));
}
```

#### `d2p open`

```ts
async function open() {
  if (!await isDaemonAlive()) {
    console.error('daemon not running. run `d2p start` first.');
    process.exit(1);
  }
  openBrowser('http://localhost:5173');
}
```

#### `d2p doctor`

```ts
async function doctor() {
  // 调 GET /api/doctor; 漂亮打印 + 退出码反应 ok
  const r = await fetch('http://localhost:5174/api/doctor').then(r => r.json());
  for (const c of r.checks) {
    console.log(c.ok ? `✓ ${c.name}` : `✗ ${c.name}: ${c.detail}`);
  }
  process.exit(r.ok ? 0 : 1);
}
```

#### `d2p install-service` / `uninstall-service` (MVP-1+)

预占位，MVP-0 不实现：

```ts
async function installService() {
  console.error('not implemented in MVP-0. run `d2p start` manually for now.');
  process.exit(2);
}
```

### Commander 入口

```ts
// cli/src/index.ts
import { Command } from 'commander';

export async function main(argv: string[]) {
  const program = new Command();
  program.name('d2p').version('0.1.0');
  program.command('start').option('--no-open').action(start);
  program.command('stop').action(stop);
  program.command('status').action(status);
  program.command('open').action(open);
  program.command('doctor').action(doctor);
  program.command('install-service').action(installService);
  program.command('uninstall-service').action(uninstallService);
  await program.parseAsync(argv);
}
```

### `openBrowser`

```ts
async function openBrowser(url: string) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
            : platform === 'win32' ? 'cmd'
            : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  await runSubproc({ cmd, args, timeoutMs: 5000 });
}
```

### Pid file

`~/.d2p/daemon.pid` —— 单个 daemon 实例只允许一台。`d2p start` 在拿到锁前 `lockfile` (advisory)。
