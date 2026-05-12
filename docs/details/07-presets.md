# 07 — Preset Library

> 6 份内置 preset。markdown checklist + frontmatter。
> Differ agent 拿原文判断每条 status。
> 用户 override 走 `<demo>/.d2p/preset-overrides.yaml`。

## File layout

```
presets/
├── saas-web.md
├── api-service.md
├── cli-tool.md
├── library.md
├── static-site.md
└── unknown.md
```

每份文件均按 schema：

```
---
type: <slug>
name: <human readable>
version: 1
high_sensitivity_categories: [<category>, ...]   # optional
---

# <Preset name>

## <Category title>
- [ ] <slug>: <Chinese description>
- [ ] <slug>: <Chinese description>

## <Another category>
- [ ] ...
```

slug 正则 `^[a-z][a-z0-9-]{1,63}$`，全文件内唯一。

## presets/saas-web.md

```markdown
---
type: saas-web
name: SaaS Web Application
version: 1
high_sensitivity_categories: [auth, input-validation, sql, crypto]
---

# SaaS Web Application Preset

## Identity & Auth
- [ ] auth-signup: 用户能完成注册（邮箱+密码或 SSO 至少一种）
- [ ] auth-login: 用户能登录并拿到合法 session
- [ ] auth-session-safety: session 使用 HttpOnly / Secure cookie，含过期与续期
- [ ] auth-csrf: 关键写操作有 CSRF 保护或 SameSite 严格
- [ ] auth-password-storage: 密码以 bcrypt/argon2 等加盐 hash 存储，不存明文
- [ ] auth-recovery: 提供忘记密码或邮件验证流程（至少占位实现）

## Data Persistence
- [ ] db-real: 持久层非 in-memory 或 mock；进程重启数据不丢
- [ ] db-migrations: 有可重放的 schema 迁移机制（migrations 目录 + 顺序号）
- [ ] db-backup-path: 至少有一种导出 / 备份手段（脚本或文档）
- [ ] db-connection-pool: 数据库连接经池管理，不为每请求新建

## Input & Validation
- [ ] input-schema: 所有外部输入有 schema 校验（zod / yup / 等）
- [ ] input-error-format: 校验失败返回结构化错误，含字段定位

## Reliability
- [ ] err-handler: 有全局错误处理中间件，不裸泄 stack
- [ ] err-observability: 至少 stderr 结构化日志或接 Sentry 同类 hook
- [ ] timeouts: 关键外部调用（DB / HTTP / RPC）有超时
- [ ] tests-smoke: 至少 1 个 e2e smoke 覆盖核心 flow
- [ ] tests-unit: 关键业务逻辑有单元测试

## Productization
- [ ] deploy-config: 有部署配置（Dockerfile / Procfile / fly.toml / vercel.json 其一）
- [ ] deploy-env-doc: README 或 ENV_VARS.md 列出所有环境变量及示例
- [ ] ci-pipeline: 有 CI 配置文件（GitHub Actions / GitLab CI 等）跑 lint+test
- [ ] docs-readme: README 含 安装 / 启动 / 部署 三段，每段含具体命令
- [ ] docs-changelog: 有 CHANGELOG.md 或等同的变更记录起点
- [ ] license: 仓库根有 LICENSE 文件且 package manifest 声明 license 字段
- [ ] gitignore: .gitignore 覆盖 node_modules / 构建产物 / .env*

## UX Polish
- [ ] ui-loading: 异步操作有 loading 态视觉
- [ ] ui-error: 失败有用户可见错误提示（不是控制台才看得见）
- [ ] ui-empty-state: 关键列表 / 页面有空态文案
- [ ] a11y-basic: 表单标签关联、按钮有 accessible name（基础 a11y）
```

## presets/api-service.md

```markdown
---
type: api-service
name: API Service / Backend
version: 1
high_sensitivity_categories: [auth, input-validation, sql, network, crypto]
---

# API Service Preset

## Identity & Auth
- [ ] auth-strategy: 至少一种鉴权（API key / JWT / OAuth）落地
- [ ] auth-scoping: 资源访问按用户/租户隔离
- [ ] auth-token-rotation: token / API key 有撤销或轮换机制（占位即可）

## Data
- [ ] db-real: 持久层非 mock
- [ ] db-migrations: 可重放迁移机制
- [ ] db-indexing: 主查询路径有索引
- [ ] db-connection-pool: 连接池管理

## API Contract
- [ ] api-spec: 有 OpenAPI / API 文档（自动或手写）
- [ ] api-versioning: 版本策略（URL prefix / header）
- [ ] api-error-codes: 错误码列表 + 含义
- [ ] api-rate-limit: 全局或按 key 的限流（占位实现可）

## Input & Validation
- [ ] input-schema: 所有 endpoint 输入有 schema 校验
- [ ] input-size-limit: body 体积上限
- [ ] input-error-format: 4xx 含 problem+json 或一致错误格式

## Reliability
- [ ] err-handler: 全局错误处理
- [ ] err-observability: 结构化日志 + 错误上报 hook
- [ ] timeouts: 上下游调用超时
- [ ] tests-smoke: e2e 跑通主要 endpoint
- [ ] tests-unit: 业务逻辑单测
- [ ] tests-contract: API 契约测试或回归测试集

## Productization
- [ ] deploy-config: 部署配置
- [ ] deploy-env-doc: 环境变量文档
- [ ] ci-pipeline: CI
- [ ] docs-readme: README 三段
- [ ] docs-curl-examples: README 含 curl 示例或客户端示例
- [ ] license: LICENSE
- [ ] gitignore: 妥当
```

## presets/cli-tool.md

```markdown
---
type: cli-tool
name: Command Line Tool
version: 1
high_sensitivity_categories: [file-ops, input-validation]
---

# CLI Tool Preset

## Surface
- [ ] cli-help: --help 输出列出所有子命令 + flags + 示例
- [ ] cli-version: --version 输出语义化版本
- [ ] cli-exit-codes: 不同失败用不同 exit code，0 仅代表成功
- [ ] cli-stderr-stdout: 提示信息到 stderr，机器可读输出到 stdout
- [ ] cli-flags-consistent: 长短 flag 一致，help 一致

## Input
- [ ] input-validation: flag / args 校验，失败给可读错误
- [ ] input-stdin: 支持 stdin 输入（如果适用）
- [ ] file-paths-safe: 文件路径处理含 .. 校验，不允许越界写

## Behavior
- [ ] idempotent: 重复跑同一命令对状态不重复破坏
- [ ] dry-run: 关键破坏性命令有 --dry-run / 预演模式
- [ ] confirm-destructive: --force 显式才执行破坏性动作

## Reliability
- [ ] err-messages: 错误信息含怎么修建议，不是 stack
- [ ] tests-smoke: 至少一个端到端命令调用 smoke
- [ ] tests-unit: 关键解析 / 业务函数单测

## Productization
- [ ] package-bin: package.json 含 bin 字段（或对应语言入口）
- [ ] install-instructions: README 含本地 / global 安装方式
- [ ] docs-readme: README 含 安装 / 用法 / 示例 三段
- [ ] changelog: CHANGELOG 起点
- [ ] license: LICENSE
- [ ] ci-pipeline: CI 跑 test on linux/macos/windows 至少 ≥1 个
```

## presets/library.md

```markdown
---
type: library
name: Library / SDK
version: 1
high_sensitivity_categories: [input-validation]
---

# Library Preset

## API Surface
- [ ] api-typed: 公开 API 有类型定义（TypeScript / .d.ts / py.typed / 等）
- [ ] api-no-side-effects-on-import: import 不产生副作用（无 console / IO）
- [ ] api-versioning: semver 起点 + CHANGELOG
- [ ] api-deprecation: 公开 API 改动可见性（注释或 dep flag）

## Quality
- [ ] tests-unit: 公开 API 单测覆盖
- [ ] tests-snapshot-or-property: 关键路径有 snapshot 或 property test
- [ ] docs-api: API 文档（typedoc / sphinx / godoc 或等同）
- [ ] docs-readme: README 含 安装 / 30 秒上手 / 链接到完整 API 三段

## Packaging
- [ ] package-exports: 包导出字段正确（exports / main / module / types）
- [ ] tree-shakeable: ESM 默认；公开符号 named export 不挂顶级副作用
- [ ] sourcemap: 发布产物含 sourcemap
- [ ] no-dev-deps-in-runtime: runtime 只 import 声明的依赖
- [ ] license: LICENSE + manifest license 字段

## Operations
- [ ] ci-pipeline: CI 跑 test + typecheck
- [ ] release-script: 一键发布脚本或文档（npm publish / cargo publish / pip publish）
- [ ] examples-folder: examples/ 或 README 示例可跑
```

## presets/static-site.md

```markdown
---
type: static-site
name: Static Site
version: 1
high_sensitivity_categories: []
---

# Static Site Preset

## Content
- [ ] content-no-lorem: 没有 lorem ipsum 残留
- [ ] content-real-links: 顶部导航链接均可达，无 404
- [ ] images-have-alt: 所有 <img> 有 alt
- [ ] favicon: 有 favicon

## SEO & Meta
- [ ] meta-title: 每页 <title> 独立有意义
- [ ] meta-description: <meta description>
- [ ] open-graph: og:title / og:image / og:description
- [ ] sitemap: sitemap.xml 或同等

## Performance
- [ ] perf-image-optimized: 关键 hero image 经压缩
- [ ] perf-lighthouse-90: Lighthouse 移动 ≥ 90 分（Performance）
- [ ] preload-critical: 关键资源 preload

## Productization
- [ ] deploy-config: 部署配置（Vercel / Netlify / CF Pages 等）
- [ ] custom-domain-docs: README 含自定义域名步骤
- [ ] docs-readme: README 含 dev / build / deploy 三段
- [ ] license: LICENSE
- [ ] analytics-or-empty: analytics 已接入或显式说明不接（不留半截）
```

## presets/unknown.md

```markdown
---
type: unknown
name: Unknown Project Type
version: 1
high_sensitivity_categories: []
---

# Unknown Project Preset

> 用户选了 unknown 或 detector 不能确定时使用。
> 仅保留最低公共 baseline；其余 gap 由 vision 推。

## Baseline
- [ ] docs-readme: README 含 安装 / 启动 / 用法 三段
- [ ] license: LICENSE
- [ ] gitignore: .gitignore 妥当
- [ ] tests-any: 任意形式的自动化测试存在
- [ ] err-meaningful: 错误信息可读，不是 stack
```

## Override 文件格式

`<demo>/.d2p/preset-overrides.yaml`：

```yaml
# 增加自定义 gap
add:
  - slug: oauth-google
    category: auth
    description: 支持 Google OAuth 登录
    severity: P2

# 从 preset 中移除某条（"我们不写单元测试"）
remove:
  - tests-unit

# 暂时跳过（不阻塞 done，但仍显示为 skipped）
skip:
  - deploy-config
```

格式约束：
- 三个 key 都可选，缺即视为空数组
- `add[].slug` 不能与 preset 内或同 yaml 内其他 add 重复
- `remove[]` / `skip[]` 必须命中 preset 中的 slug；不命中 daemon 启动时 warn 但不阻塞

## Differ 怎么用 preset

```ts
const presetMd = await readFile(`presets/${session.presetType}.md`, 'utf8');
const overrides = await readPresetOverrides(demo.path);

const differOutput = await callClaude({
  role: 'differ',
  model: 'sonnet',
  promptInputs: {
    vision_md: visionContent,
    preset_md: presetMd,                  // 原文丢给 differ
    preset_overrides: yaml.dump(overrides),
    repo_summary: summary,
    done_gap_history: historyText,
  },
  // ...
});

// daemon 应用 overrides：
const gaps = differOutput.gaps
  .concat(overrides.add.map(toGap))
  .filter(g => !overrides.remove.includes(g.slug));
const presetStatus = differOutput.presetStatus
  .map(s => overrides.skip.includes(s.item)
    ? { ...s, status: 'done' }    // skip 视作 done 不阻塞
    : s);
```

## High Sensitivity 触发 Adversarial

```ts
const frontmatter = parseFrontmatter(presetMd);
const highSensCats = new Set([
  ...HIGH_SENSITIVITY_CATEGORIES,
  ...(frontmatter.high_sensitivity_categories ?? []),
]);
const adversarialNeeded =
  highSensCats.has(gap.category) ||
  behavioralReview.confidence < 0.85;
```

## 添加新 preset

MVP-0：手动加 markdown 文件 → 加进 `daemon/src/preset/index.ts` 的内置注册表 → 加 detector 类型枚举。

MVP-1+：UI 支持 "import preset markdown" + 用户起名；类型集动态。
