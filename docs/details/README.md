# d2p 细节开发文档索引

> Companion to `../DEV-DOC.md`（overview）。这里是各组件的可直接照抄实现的细节。
> 改任一文档时同步检查交叉引用。

| # | 文件 | 范围 |
|---|---|---|
| 01 | `01-prompts.md` | 全部 9 个 agent 角色的 prompt 模板 + JSON schema + 通用契约 |
| 02 | `02-types.md` | 跨 workspace 共享的 TypeScript 类型（domain entities、agent IO、API DTO、状态枚举） |
| 03 | `03-storage.md` | SQLite schema 完整 DDL、migrations、关键查询、PRAGMA、索引 |
| 04 | `04-api-contracts.md` | REST + SSE 全 endpoint 请求/响应 schema + Hono 路由骨架 |
| 05 | `05-subprocess.md` | `claude` / `git` / check command 子进程封装、prompt 注入防御、token 抓取、价格表 |
| 06 | `06-state-machines.md` | Session / Gap / Fix 状态机 + 主循环伪码 + 重启恢复 |
| 07 | `07-presets.md` | 6 份内置 preset 完整 markdown + override 文件格式 + differ 怎么用 |
| 08 | `08-ui-cli-spec.md` | UI 4 页 wireframe + 组件树 + Zustand store；CLI 6 个 command |
| 09 | `09-config-files.md` | 全局 `~/.d2p/` + per-demo `<demo>/.d2p/` + preset library 三层配置 schema |
| 10 | `10-build-test-order.md` | Workspaces 设置 + 测试分层 + 30 天分 phase 实施顺序 |

阅读顺序建议：
1. 先看根 `../DEV-DOC.md` 全貌（§0–§9）
2. 再按 02 → 03 → 04 → 05 → 06 → 01 → 07 → 09 → 08 → 10 顺序细读
   - 02 是骨架（类型）；03–06 是后端核；01+07+09 是 AI/资源；08 是表面；10 是落地节奏

每份文档的代码示例可直接当作 implementation skeleton 抄，但要按 02-types.md 的类型校准签名。
