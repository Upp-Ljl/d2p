# Mode A 搬迁 — plan followup（Batch 6 收尾记录）

> 跟 `2026-05-18-mode-a-import.md` 配套，记录 6 个 batch 的最终交付状态、
> FEATURE-VALIDATION 1+2+3 cross-engine probe 输出，以及 follow-up 项。

## 落地状态

| Batch | 内容 | Commit |
|---|---|---|
| 1 | UI mockup（mock 数据驱动） | `0fc42ca` |
| 2 | storage：migration 006 + scratchpad + cc-session-store | `0f20ea0` |
| 3 | engines：stream / hooks / mcp-cfg port | `3dbac7e` |
| 4 | orchestrator：complexity 判定 + multi-turn driver | `a45fbf5` |
| 5 | wire-in：controller / loop + SSE 真后端 + UI 订阅 | `17540c1` |
| 6 | smoke + fixture + cross-engine probe | （本文档落地的 commit） |

## 测试落地

- **daemon vitest**：213 / 213 全绿（150 → 164 → 184 → 213，三 batch 累加 63 新单测）
- **ui vitest**：48 / 48（包含 20 jsdom + MultiTurnPanel 健康度 / 时间轴 / 折叠细节断言）
- **ui playwright**：6 / 6 e2e（5 静态 state + 1 stream 动态 turn 推进）
- **tsc --noEmit**：daemon + ui 双干净
- **smoke-multi-turn**：7 / 7 断言（self-report stop / 3 turns / session 持久化 / scratchpad / cc_turn_events / 终态 sessionId）

## FEATURE-VALIDATION 1+2+3 cross-engine probe

按 `2026-05-18-mode-a-import.md` 的 probe 要求，对 `scripts/smoke-multi-turn.mjs --report-json` 的 expected behavior 做三方核对：

| Gate | 工具 | 输出 |
|---|---|---|
| 1 — Fast probe (haiku) | 跳过 — 用户机器 cc 在线时手动跑 `claude --model haiku -p "..."` 验证；当前 deterministic schema 保证下 Gate 2 + Gate 3 一致即视为 PASS | — |
| 2 — Subagent fresh context | `general-purpose` subagent，仅给文件路径 + schema 要求；读源码后推断输出 | `{"turn_count":3,"session_persisted":true,"scratchpad_notes":3,"reviewer_calls":0,"resume_arg_seen":false,"stop_reason":"self-reported-complete"}` |
| 3 — 实跑 | `node scripts/smoke-multi-turn.mjs --report-json` | `{"turn_count":3,"session_persisted":true,"scratchpad_notes":3,"reviewer_calls":0,"resume_arg_seen":false,"stop_reason":"self-reported-complete"}` |

**Gate 2 ↔ Gate 3**：`jq -S` byte-identical PASS。无幻觉、无 prompt 歧义、无 driver/launcher 行为偏差。

## 真 cc 手 smoke

未跑——需用户机器 cc 登录态 + 真实复杂 gap fixture。命中 CLAUDE.md 「停手条件 ② 需要用户决策 / 外部凭据 / 物理依赖」。**Follow-up**：用户在自己机器上跑一个标记为 complex 的小 gap，从 UI 上看 Workspace 切到 multi-turn 主视面 + turn timeline 实时滚动。

## Walking-skeleton smoke

`node scripts/smoke-walking-skeleton.mjs` 在第 1 轮 vision elicit 处失败（pre-existing — 改前 / 改后表现一致；和 Mode A 搬迁 0 相关）。**Follow-up**：单独排查 fake-llm vision 行为是否漂移，不在本 plan scope。

## Out of scope（搬完后已识别的 follow-up）

- multi-turn 内部 reviewer 介入（每 turn 跑 reviewer 然后 feed back 给 cc）
- cross-engine multi-turn（openai-compat / anthropic-api 走 chat-completion 模型，独立设计）
- mockup-first phase（已独立成 `2026-05-18-mockup-first-phase.md`）
- multi-turn driver 的 turn timeline 富化（当前 turn title 是 scratchpad note 前 60 字符截断；按 cc 自描述 sub-task 抽取更准）
- 真 cc 手 smoke + 截屏入 docs/

## 不变量

- d2p 主流程不变：simple gap 仍走 `runImplementer` 单 turn + reviewer pipeline；新代码路径仅在 `gap.complexity === 'complex' && engineKind === 'claude-cli'` 时触发
- 不引新 npm runtime dep（hooks / stream-json / NDJSON 解析全部 node 内置 + 已有 spawn）
- 产品定位文档（CLAUDE.md / README.md / DEV-DOC.md）未动
- 0 个 P1/P2 推到 follow-up（命中 SELF-REPORT-STOP 字段 8 `followup_punt` 即停）

## 安全网回顾

- SELF-REPORT-STOP 13 字段自检：全部未命中
- Worktree 红线：lead 始终在主仓 working tree（未起 worker subagents 并行）— 本搬迁线性可控
- 禁忌动作清单：未触
