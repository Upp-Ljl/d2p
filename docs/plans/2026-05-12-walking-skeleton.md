# d2p Walking Skeleton (MVP-0)

> Status: **DRAFT v2**（post-12-round-grill 重写）。
> Parent: `docs/DEV-DOC.md` §8 (Phasing).
> Scope: 端到端真闭环——从 demo + vision 到 1 个 gap 完整跑通到 merge，触发 done-check。

---

## 1. Plan

实现 DEV-DOC §3 全部 component 的 **MVP-0 切片**：

**核心闭环**：
```
d2p start
  → 选 demo folder（任意，d2p 自动 git init）
  → AI 看仓库 → 推 preset type → 用户确认
  → 多轮 vision elicit（≤5 轮 A/B/C） → 存 vision.md
  → differ 出 gap 列表
  → 取 gap[0] → worktree → implementer → static gate → alignment probe → behavioral reviewer → adversarial（若高敏）
  → merge fix/<slug> 回 main
  → done-check（双绿？）
  → 未双绿 → 回 differ → ... → 双绿停 / 用户 Pause 停
```

**MVP-0 一体进程**：daemon + UI 共生在 `npm run dev` 下；MVP-1+ 才拆系统服务。

**栈**（DEV-DOC §3.1 / §4.x 已 spec）：
- Node 24 + TypeScript（NodeNext）
- Hono on Node（daemon）
- Vite + React + Tailwind + shadcn/ui（UI）
- better-sqlite3 ^12.9.0
- vitest
- commander（CLI）
- 子进程：`claude -p` + `git` CLI（无 JS git lib）

---

## 2. Expected Outputs

按 DEV-DOC Appendix A 文件布局全量落盘。关键 deliverables：

```
D:/lll/d2p/
├── package.json                    # workspaces: daemon, ui, cli
├── presets/{saas-web,api-service,cli-tool,library,static-site,unknown}.md  (6 内置)
│
├── daemon/src/
│   ├── server.ts                   # Hono, port 5174
│   ├── routes/{session,vision,loop,gaps,preset,log}.ts
│   ├── orchestrator/loop.ts        # 主状态机
│   ├── detector/index.ts           # claude --model haiku -p
│   ├── vision/index.ts             # 多轮 elicit
│   ├── differ/index.ts             # gap 生成
│   ├── implementer/index.ts        # 在 worktree 写代码
│   ├── reviewer/{alignment,behavioral,adversarial,done-check}.ts
│   ├── git/{worktree,merge}.ts
│   ├── subproc/spawn.ts            # claude / git 单出口
│   ├── storage/db.ts + migrations/{001-init,002-presets,003-cost}.ts
│   └── log/events.ts
│
├── ui/src/
│   ├── main.tsx, App.tsx
│   ├── api.ts, store.ts
│   └── pages/{Landing,Setup,Workspace,Done}.tsx
│
├── cli/
│   ├── bin/d2p
│   └── src/index.ts                # start/stop/status/open/doctor
│
├── scripts/smoke-walking-skeleton.mjs
├── fixtures/demo-saas/             # tiny Next.js demo, has gaps
└── tests/
    ├── daemon/{detector,differ,implementer,reviewer,git,orchestrator}.test.ts
    ├── ui/                         # 至少 store + api 测试
    └── cli/                        # smoke
```

**SQLite schema**: migrations 001-003 全落（DEV-DOC §4.4 完整 DDL）。

**Commit 路径**：先初始化 d2p 自己为 git repo，本 walking skeleton 全在 `feat/walking-skeleton` 分支。

---

## 3. How To Verify

```bash
# 0. clean install
cd D:/lll/d2p
npm install
# expect: exit 0

# 1. typecheck + build 全 workspace
npm run build
# expect: exit 0, daemon/dist + ui/dist + cli/dist 都产物

# 2. unit tests
npm test
# expect: ≥ 40 tests pass (component spec 多)

# 3. smoke 端到端（headline）
node scripts/smoke-walking-skeleton.mjs
# expect 大致：
#   [smoke] 拷 fixtures/demo-saas 到 tempdir
#   [smoke] 起 daemon (5174) + UI dev server (5173)
#   [smoke] POST /api/session/start with demo_path
#   [smoke] AI detector 输出 type=saas-web confidence>=0.5
#   [smoke] vision elicit 模拟用户回答 3 轮
#   [smoke] vision.md 落盘
#   [smoke] differ 输出 ≥3 gaps
#   [smoke] start loop
#   [smoke] gap[0] 走完 implement→static→alignment→behavioral→merge
#   [smoke] main 上有 merge commit
#   [smoke] done-check 跑过（未双绿，OK）
#   [smoke] pause loop
#   [smoke] cleanup
#   [smoke] PASS

# 4. UI 手测（manual smoke，每次发版至少一次）
npm run dev
#   → 浏览器开 localhost:5173
#   → 选 fixtures/demo-saas
#   → 确认 type
#   → vision 多轮回答完
#   → Workspace 页 → Start loop
#   → Live Run Log 实时滚动事件 + thought summary
#   → 1 个 gap merge 成功后 Pause
#   → 关浏览器、重开、看到 paused 状态
#   → Resume 继续跑
```

**Hard gates**（CLAUDE.md §Gates）：
- DB schema 改、子进程 spawn、文件系统行为变更 → 单测不够，必须 smoke 跑过
- UI 改 → 必须 npm run dev 真浏览器跑一次

---

## 4. Probes

```bash
# Probe 1 — claude haiku 看实现摘要
claude --model haiku -p \
  'Read D:/lll/d2p/daemon/src/server.ts, D:/lll/d2p/daemon/src/orchestrator/loop.ts.
   Output JSON only:
   {"daemon_port": ..., "loop_states": [...], "reviewer_layers": [...], "uses_worktree": true|false}' \
  | jq -S . > /tmp/d2p-mvp0-probe1.json

# Probe 2 — Agent subagent fresh context (general-purpose)
# Spawn Agent(subagent_type: "general-purpose", prompt: same as above)
# 保存到 /tmp/d2p-mvp0-probe2.json
jq -S . /tmp/d2p-mvp0-probe2.json > /tmp/d2p-mvp0-probe2.canonical.json

diff -u /tmp/d2p-mvp0-probe1.json /tmp/d2p-mvp0-probe2.canonical.json
# expect: empty

# Probe 3 — real smoke JSON
node scripts/smoke-walking-skeleton.mjs --json > /tmp/d2p-mvp0-probe3.json
jq -S '.summary' /tmp/d2p-mvp0-probe3.json > /tmp/d2p-mvp0-probe3.canonical.json
# expect: 含 detected_type / gap_count / merged_fix_count / done_check_verdict
```

---

## 5. Out of Scope（MVP-0 explicit ¬）

完全延后到 MVP-1+，详 DEV-DOC §8：

- Daemon 拆系统服务
- 并发 N（默认 1 串行）
- Cross-engine reviewer second pass（adversarial 单独跑就 OK）
- 自定义 preset UI（手编 YAML 即可）
- 多 demo 切换（一个 session 一个 demo）
- Cost cap（仅记录不限）
- GitHub PR 自动开 / push 自动
- 远程 daemon / 多浏览器并连
- Plugin preset 机制
- 非代码输入（PRD / mockup）
- 接其他 engine（Codex 等）

---

## 6. Acceptance Checklist (≤5 行，per CLAUDE.md §Gates)

1. **目标**：fixtures/demo-saas 端到端跑通 1 个 gap merge + done-check 触发
2. **不变量**：用户 demo 仓库永远 fast-forward / no-ff merge，绝不 reset --hard；worktree 仅 fix 分支用
3. **验证命令**：`node scripts/smoke-walking-skeleton.mjs` exit 0 + manual UI smoke 走完
4. **不做**：DEV-DOC §8 MVP-1+ 全部
5. **Done means**：smoke 绿 + manual UI 绿 + ≥40 单测绿 + probe 1+2+3 byte-match
