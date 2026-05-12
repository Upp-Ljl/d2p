# 10 — Build / Test / Implementation Order

## Workspaces

`D:\lll\d2p\package.json`：

```json
{
  "name": "d2p",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["daemon", "ui", "cli"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "dev": "node scripts/dev.mjs",
    "smoke": "node scripts/smoke-walking-skeleton.mjs",
    "clean": "node scripts/clean.mjs"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.0.0",
    "@types/node": "^24.0.0",
    "prettier": "^3.3.0"
  },
  "engines": { "node": ">=24.0.0" }
}
```

`tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

每个 workspace 自己的 `tsconfig.json` `extends: "../tsconfig.base.json"`。

### `daemon/package.json`

```json
{
  "name": "@d2p/daemon",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch src/server.ts"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "better-sqlite3": "^12.9.0",
    "zod": "^3.23.0",
    "yaml": "^2.5.0",
    "gray-matter": "^4.0.3",
    "shell-quote": "^1.8.1"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/shell-quote": "^1.7.0"
  }
}
```

### `ui/package.json`

```json
{
  "name": "@d2p/ui",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0",
    "marked": "^14.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0"
  }
}
```

### `cli/package.json`

```json
{
  "name": "@d2p/cli",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "bin": { "d2p": "./bin/d2p" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0"
  }
}
```

## Dev mode (`scripts/dev.mjs`)

一体起 daemon + Vite UI：

```js
import { spawn } from 'node:child_process';

const daemon = spawn('npm', ['run', 'dev', '-w', 'daemon'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
const ui = spawn('npm', ['run', 'dev', '-w', 'ui'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 优雅停
function shutdown() {
  daemon.kill('SIGTERM');
  ui.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

`daemon` 监听 5174；UI 监听 5173 + proxy `/api/*` 到 5174。

`ui/vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5174', changeOrigin: true },
    },
  },
});
```

## Testing 策略

### 测试分层

| 层 | Tool | 范围 | 速度目标 |
|---|---|---|---|
| Unit | vitest | 单函数 / 单模块；mock 边界（claude / git / fs） | <2s 全套 |
| Integration | vitest | daemon 全功能跑通；用 in-memory sqlite + fake claude/git；mock subproc | <10s 全套 |
| Smoke (e2e) | node script | 真起 daemon + UI（无浏览器）+ 真 fixture demo；mock 或绕过 claude | <60s |
| Manual UI | 人 | 浏览器走一遍 | 每次发版 ≥1 次 |

### Unit 覆盖目标

每个组件至少：
- 正常路径 1 个
- 边界 1-3 个（空输入 / 极端值 / 错误输入）
- 状态机迁移合法性 1 个

### Integration 覆盖目标

- 全 API endpoint 至少 1 个测试（路由 + DB 影响）
- Loop 主循环 1 个测试（fake claude，可控 differ 输出 → 实际跑 1 个 gap 到 MERGED）
- State machine 违规 throw 1 个测试每张表

### Smoke 覆盖目标

- `scripts/smoke-walking-skeleton.mjs`：起真 daemon + UI（headless）→ POST session/start → 验路由通 → 验 fixture demo 已 git init → mock claude responses → 跑 1 gap 全闭环 → assert MERGED + done-check 触发

### Mocking claude / git

`daemon/src/subproc/spawn.ts` 暴露 hook：

```ts
let __mockCallClaude: ((opts: any) => Promise<any>) | null = null;
export function __setMockCallClaude(fn: typeof __mockCallClaude) {
  __mockCallClaude = fn;
}
```

测试 setup 用 `__setMockCallClaude(fakeResponses)` 把真 spawn 短路。

`git` 类似 hook，或者直接对 `fixtures/demo-saas/` 复制副本到 tempdir 跑真 git（更接近真实，但慢；按需用）。

### Test fixtures

```
fixtures/
├── demo-saas/                        # 一个 Next.js 风格 tiny demo
│   ├── package.json                  # next + react + sqlite，缺很多 product 必备
│   ├── src/app/page.tsx              # hello world
│   ├── README.md                     # minimal
│   └── .gitkeep                      # （tests setup 跑 git init）
├── fake-claude-responses/
│   ├── detector-saas-web.json
│   ├── vision-round-1.json
│   ├── differ-3-gaps.json
│   ├── implementer-auth-signup.json
│   ├── alignment-08.json
│   ├── behavioral-approve.json
│   └── done-check-not-yet.json
└── README.md                         # 说明 fixtures 用法
```

## Implementation Order

按依赖排，每步可独立验。

### Phase 0 — Skeleton (Day 1-2)

1. `package.json` workspaces + tsconfig.base.json
2. 三 workspace 各 `package.json` + 空 `src/index.ts`
3. `npm install` 干净跑通
4. `npm run typecheck` 三个 workspace 各自空过

**Verify**: `npm install && npm run typecheck` exit 0.

### Phase 1 — Daemon foundation (Day 3-5)

1. `daemon/src/types.ts` — 详 02-types.md
2. `daemon/src/storage/db.ts` + migrations 001-003 — 详 03-storage.md
3. `daemon/src/storage/queries.ts` — prepared statements
4. `daemon/src/state/transitions.ts` — 状态机表
5. Unit tests for migrations + transitions

**Verify**: `npm run test -w daemon` 全绿 + DB 文件能落地能读回。

### Phase 2 — Subprocess layer (Day 6-7)

1. `daemon/src/subproc/spawn.ts` — runSubproc 通用 wrapper
2. `daemon/src/subproc/claude.ts` — callClaude + role timeout + token usage parse
3. `daemon/src/subproc/git.ts` + git helpers
4. `daemon/src/static-gate/check.ts`
5. `daemon/src/cost/pricing.ts`
6. Unit tests with `__setMockCallClaude` + git on tempdir

**Verify**: callClaude 真起一次 `claude -p "echo 'hi'"` 拿回 JSON（手测）。

### Phase 3 — Prompts (Day 8-9)

1. `daemon/src/prompts/render.ts` + 9 个 template 字符串
2. Forbidden substring guard tests
3. Schema validators (zod) for each agent output

**Verify**: `renderPrompt('detector', {...})` 输出长字符串可肉眼读 + injection 测试 throw。

### Phase 4 — HTTP API (Day 10-12)

1. `daemon/src/server.ts` — Hono setup + CORS
2. Routes：session / vision / loop / gaps / preset / detector / log / health
3. SSE log stream
4. Integration tests for every endpoint

**Verify**: `npm run dev -w daemon` 起 + curl 全 endpoint 通。

### Phase 5 — Orchestrator (Day 13-15)

1. `daemon/src/orchestrator/loop.ts`
2. Detector / Vision elicitor / Differ wiring
3. Implementer + Reviewer pipeline wiring
4. Done-check wiring

**Verify**: integration test 用 fake claude responses 跑 1 个 gap 到 MERGED + done-check 触发。

### Phase 6 — UI (Day 16-20)

1. Vite + React boilerplate
2. `ui/src/store.ts` Zustand
3. `ui/src/api.ts` REST + SSE client
4. Landing.tsx + Setup.tsx
5. Workspace.tsx + 子组件
6. Done.tsx

**Verify**: `npm run dev` 浏览器走一遍假数据。

### Phase 7 — CLI (Day 21-22)

1. `cli/bin/d2p` + `cli/src/index.ts` + commander 路由
2. `start` / `stop` / `status` / `open` / `doctor`
3. pid file 管理 + daemon health poll

**Verify**: `npm link cli && d2p start && d2p status && d2p stop` 干净跑通。

### Phase 8 — Smoke + dogfood (Day 23-25)

1. `fixtures/demo-saas/` 准备
2. `fixtures/fake-claude-responses/` 录
3. `scripts/smoke-walking-skeleton.mjs`
4. 跑 smoke 全闭环
5. 手测 UI 一遍（用真 cc 跑一个真 fix）

**Verify**: `npm run smoke` exit 0 + 真跑 UI 跑通 1 个 fix merge。

### Phase 9 — Polish + docs (Day 26-30)

1. README.md (项目根 + 三 workspace 各一份)
2. ARCHITECTURE.md（指向 DEV-DOC.md）
3. CHANGELOG.md
4. `d2p doctor` 所有 check 实现
5. UI 错误态全覆盖（断网 / cc 未登录 / git 找不到）
6. SSE 重连测试
7. SQLite 损坏 recovery 测试

**Verify**: 给真朋友试一次（dogfood 真 demo），收集反馈，1 个月里程碑达成。

## CI（MVP-1+）

`.github/workflows/ci.yml` (placeholder)：
- node 24 matrix windows-latest / ubuntu-latest / macos-latest
- `npm install && npm run typecheck && npm test`
- 不跑 smoke（需要 cc + real Anthropic 账号，CI 内不可行）

## 版本控制

- 一开始：`git init` + `chore: initial commit`
- 长期：feature branch + PR per phase；按 CLAUDE.md workflow 走
- d2p 自身首次 push 前与用户确认 remote URL（locked 在 DEV-DOC.md §10 §1 / Open Decisions）

## 安装方式（MVP-0）

```bash
git clone <repo>  # 或 用户已 clone
cd d2p
npm install
npm run build
npm link --workspaces  # 让 d2p CLI 全局可用
d2p start
```

MVP-1+ 考虑 `npm publish`。
