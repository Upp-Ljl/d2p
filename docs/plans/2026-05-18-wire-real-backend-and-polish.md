# 接真后端 + 动画升级 + mockup-first plan 启动（并行）

> Batch 1-6 完工后，并行推三条线：
> 1. **真后端 wire**：Workspace 终版三块（StatusStrip / SessionsBoard / CommitsTimeline）从 mock 切到真 daemon 数据
> 2. **mockup-first phase**：d2p 新产品功能 — 给用户做事前先帮他用 HTML 出"成品预期"。"能出 HTML 就出，不适合的不强求"
> 3. **动画升级**：所有现有组件加精致微动效，"能加就加，不要喧宾夺主，要高级感"

**Scope source**：用户 2026-05-18 grill：
- 「接上」= 三条并行，mockup-first 是「能出就出」不是硬规则
- 动画粒度 = 微交互 + 状态过渡 + 数据动效全要，但克制不浮夸

## Acceptance checklist

1. **真后端**：进入真 session（非 demo）时，Sessions / Commits / Preset KPI 走真 daemon API；mock 仅在 `multiTurnDemoMode=true` 时用
2. **mockup-first**：plan 文档完整 + UI mockup（点击 Landing 入口能看完整 flow）；不接后端（等用户认可 mockup 再接）
3. **动画升级**：drawer 滑入、卡片 hover、turn timeline 节点出现、进度条 spring、working glow 呼吸、数字 tick — 全部精致（≤300ms、ease-out / spring，不刺眼）
4. **不变量**：现有 daemon 213 + ui 48 测试 + smoke-multi-turn 全绿；不引新 npm runtime dep（动画用纯 CSS）
5. **完成标准**：3 个 worker 各自交付 + lead 合并 + 三方测试不回归 + 用户在终版 web 验收

## Plan — 具体改什么

### Worker A — 真后端 wire（sonnet，worktree `.worktrees/wire-real-backend`）

**写集**（不重叠）：
- `daemon/src/routes/sessions.ts`（新）：GET /api/sessions —— 聚合 log_events 按 role 出 7 个 agent 状态
- `daemon/src/routes/commits.ts`（新）：GET /api/commits —— join fixes + git log，出 commit + reviewer verdict
- `daemon/src/routes/preset-rich.ts`（新）：GET /api/preset/rich —— 出 32 项 source-of-truth shape
- `daemon/src/storage/queries.ts`（改）：新增 `aggregateSessionsByRole` / `listMergedCommits` / `listPresetRich` 方法
- `daemon/src/server.ts`（改）：注册三个新 route
- 测试：每个 route + queries 方法各一份 vitest 单测

**不动**：UI 文件（lead 负责把这些 API 接进 UI store / 组件）

### Worker B — mockup-first phase plan + Batch 1 mockup（sonnet，worktree `.worktrees/mockup-first`）

**写集**：
- `docs/plans/2026-05-18-mockup-first-phase.md`（已存在，扩充到完整 6-batch plan）
- `ui/src/mock/mockupPhase.ts`（新）：MockupPhase state shape + mock data（draft / review / approved / revising 四态）
- `ui/src/components/MockupPhasePanel.tsx`（新）：4 态布局（iframe 占位 + 多页缩略 + approve / 提建议 / 跳过 操作）
- `ui/src/preview/Preview.tsx`（改）：加 `?preview=mockup-phase/<state>` 路由
- `ui/src/preview/PreviewIndex.tsx`（改）：加 mockup-phase 入口卡片
- 测试：MockupPhasePanel.test.tsx jsdom + Playwright e2e

**不动**：Workspace / store / 现有 Landing 等主线文件（等用户认可 mockup 再接）

### Lead — 动画升级（我，主 checkout）

**写集**：
- `ui/src/index.css`：加 keyframes（breathe / drift-in / pulse-soft）+ utility classes
- `ui/src/components/SessionsBoard.tsx`：卡片 hover 微 translate + 阴影 spring；working glow 呼吸；新 turn 节点 drift-in
- `ui/src/components/CommitsTimeline.tsx`：commit 卡片 cascade fade-in；rewind hover 反转色 spring
- `ui/src/components/MultiTurnPanel.tsx`：状态变化 crossfade；进度条 spring；working dot 呼吸
- `ui/src/components/StatusStrip.tsx`：KPI hover lift；drawer 从左滑入（200ms ease-out-quart）
- `ui/src/components/PresetChecklistView.tsx`：分组 stagger fade-in；item 卡片 hover
- `ui/src/components/CountUp.tsx`（新）：requestAnimationFrame 数字 tick hook + component
- 各处数字接 CountUp：preset done / token / pct / cost / scratchpad turn

**不引新 npm dep**：纯 CSS + Tailwind transition + 一个自写 CountUp hook。

## Expected Outputs

完成后：
- 5 个新 daemon 源文件（routes/sessions.ts / commits.ts / preset-rich.ts + queries 新方法 + server wire）+ 3 个 vitest
- 4 个新 UI 源文件（mockupPhase.ts + MockupPhasePanel.tsx + Preview 改 + CountUp）+ 2 个测试
- 5 个 UI 组件加动效（不改逻辑）
- 1 个 plan followup 文档
- 3 个新 commit batch + 三方测试不回归

## How To Verify

### Gate 1 — 单测（每个 worker 跑自己 batch）
```
cd daemon && npx vitest run    # 应 213 → 213+N 全绿（worker A）
cd ui && npx vitest run        # 应 48 → 48+M 全绿（worker B + lead）
```

### Gate 2 — smoke 不回归
```
node scripts/smoke-multi-turn.mjs    # 7/7
```

### Gate 3 — preview 路径手测
- `?preview=mockup-phase/draft` 等 4 态各看一遍
- `?preview=multi-turn/stream` 5 turn 推进期间观察新动效

### Gate 4 — 终版 web 验收
- Landing 「试看 multi-turn」demo 模式：所有动效顺滑，不喧宾夺主
- 真 session（无 demo 模式）：Sessions / Commits / Preset 走真 API（worker A）

## Probes (FEATURE-VALIDATION 1+2+3)

对 worker A 的 GET /api/sessions response shape 做三方核对：

| Gate | 工具 | 输出 |
|---|---|---|
| 1 | haiku probe：给 prompt + queries.ts 文件，问 expected response JSON shape | canonical JSON |
| 2 | sonnet subagent fresh context：同问 | 同 schema JSON |
| 3 | 实跑：daemon 起来后 `curl http://localhost:5174/api/sessions` | 真实输出 |

byte-identical schema 才 ship。

## 不做什么

- ❌ 不引 framer-motion / react-spring / motion.dev 等动画库
- ❌ 不改产品定位文档（CLAUDE.md / README / DEV-DOC 主文）
- ❌ Worker B 不接 mockup phase 后端（等用户认可 mockup）
- ❌ Worker A 不动 UI 组件（lead 来 wire）
- ❌ Lead 不动 daemon / mockup phase（worker A/B 的边界）
- ❌ 动画不浮夸：禁止 scale > 1.05 / hover bounce / rotate > 5deg / 闪烁
- ❌ 不 `git push --force` / `--no-verify`

## Execution

1. **lead**：加 `.worktrees/` 到 .gitignore；起 3 个 worktree（A / B / __lead__）
2. **并行**：dispatch worker A + worker B + lead 自己开动画
3. **合并**：3 个完成后 lead 在主 checkout 合 PR / 直接 merge worktree（local-only）
4. **测试**：跑 daemon vitest + ui vitest + Playwright e2e + smoke-multi-turn
5. **commit batch**：feat(daemon-routes), feat(mockup-first), feat(ui-polish), test(smoke), docs(plan-followup)
6. **push**：合 main，push origin

## 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| 三 worker 并行写集冲突 | plan 明示写集；lead 合并时 git diff 检查冲突 |
| Worker A 后端 schema 跟 UI 期望不符 | lead 合并时用 worker A response 同步改 UI store；FEATURE-VALIDATION probe 拦 |
| 动画造成测试 flaky（jsdom 不跑 CSS） | 动画全用 className transition / animation，不动 component 逻辑；测试 className snapshot 不验 |
| `multiTurnDemoMode` 之外的真 session 无人跑过 | 不要求真 session 一次跑通；fallback: demo 模式仍可用 |
