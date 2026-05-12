# 04 — API Contracts

> Daemon HTTP server (Hono) on port 5174 (env `D2P_DAEMON_PORT`).
> CORS：MVP-0 仅允许 `Origin: http://localhost:5173` (env `D2P_UI_ORIGIN`)。
> 所有 POST 请求 `Content-Type: application/json`。响应均 JSON 编码。
> 错误使用 RFC 7807 problem+json 格式。

## 通用错误响应

```json
HTTP 4xx/5xx
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "<short>",
  "status": 400,
  "code": "<MACHINE_CODE>",
  "detail": "<long, optional>",
  "instance": "/api/session/start"
}
```

`code` 全集：`BAD_REQUEST` / `NOT_FOUND` / `CONFLICT` / `INVALID_STATE` / `CLAUDE_NOT_FOUND` / `GIT_NOT_FOUND` / `IO_ERROR` / `INTERNAL`

## Session 路由

### POST /api/session/start

Start a new session, or resume the active one on a demo.

**Req**：
```json
{ "demoPath": "D:\\demos\\my-saas" }
```
- `demoPath` 必须绝对路径
- 若该 demo 已有 status=LOOPING/PAUSED/SETUP 的 session → 返回该 session（`isResume=true`）
- 否则 d2p 自动：
  - `mkdir -p <demoPath>` if missing
  - `git init` if no `.git`
  - `git add -A && git commit -m "chore: d2p initial commit"` if no commits

**Res 200**：
```json
{
  "sessionId": 17,
  "status": "SETUP",
  "isResume": false
}
```

**Errors**：
- `BAD_REQUEST` if `demoPath` not absolute or path traversal (..)
- `IO_ERROR` if mkdir/git init fail
- `CONFLICT` if another session is LOOPING (only one global active session at a time in MVP-0)

### GET /api/session/current

**Res 200**：
```json
{
  "session": { /* Session */ },
  "demo": { /* Demo */ },
  "presetStatus": [ /* PresetStatusItem[] */ ],
  "costTotals": { "inputTokens": 12345, "outputTokens": 6789, "estimatedUsd": 0.42 }
}
```
若无活跃 session：`{ "session": null, "demo": null, "presetStatus": [], "costTotals": {...zero} }`。

### POST /api/session/end

End current session (no implicit confirm — user clicked End).

**Res 200**：
```json
{ "sessionId": 17, "status": "ENDED", "summaryMdPath": "D:\\demos\\my-saas\\.d2p\\session-summary.md" }
```

## Vision 路由

### GET /api/vision/round

Get the next round of questions (or finalized vision).

**Res 200**（继续）：
```json
{
  "done": false,
  "roundIndex": 2,
  "questions": [
    {
      "id": "r2-monetize-1",
      "question": "你打算怎么收费？",
      "options": [
        { "label": "免费 + 增值", "description": "..." },
        { "label": "订阅", "description": "..." },
        { "label": "一次性买断", "description": "..." }
      ]
    }
  ]
}
```

**Res 200**（已 finalize）：
```json
{
  "done": true,
  "visionMd": "## 产品定位\n...",
  "visionMdPath": "D:\\demos\\my-saas\\.d2p\\vision.md"
}
```

**Errors**：`INVALID_STATE` if session.status != SETUP。

### POST /api/vision/answer

Submit answers for the current round; triggers next round prompt.

**Req**：
```json
{
  "answers": [
    { "questionId": "r2-monetize-1", "answer": "订阅" }
  ]
}
```

**Res 200**：与 `GET /api/vision/round` 相同（下一轮或 finalize）。

### POST /api/vision/finalize

Force finalize from drafts (user clicks "够了，定稿" before 5 轮).

**Res 200**：
```json
{
  "done": true,
  "visionMd": "...",
  "visionMdPath": "..."
}
```

## Detection / Preset 路由

### POST /api/detector/run

Trigger project type detection (auto-fired post-`session/start`, this endpoint is for manual re-run).

**Res 200**：
```json
{
  "type": "saas-web",
  "confidence": 0.84,
  "evidence": ["next.config.ts present", "..."],
  "presetCandidates": ["saas-web", "api-service"],
  "inferredCheckCommands": {
    "build": "npm run build",
    "test": "npm test",
    "typecheck": "tsc --noEmit"
  }
}
```

### POST /api/preset/choose

Confirm preset selection (after detector + user override).

**Req**：
```json
{ "type": "saas-web" }
```

**Res 200**：
```json
{
  "type": "saas-web",
  "presetMd": "<full markdown of presets/saas-web.md>"
}
```

### GET /api/preset/current

**Res 200**：
```json
{
  "type": "saas-web",
  "presetMd": "...",
  "overrides": { /* PresetOverrides */ },
  "statusLatest": [ /* PresetStatusItem[] */ ]
}
```

### POST /api/preset/override

Save preset overrides to `<demo>/.d2p/preset-overrides.yaml`.

**Req**：
```json
{
  "overrides": {
    "add": [{"slug": "oauth-google", "category": "auth", "description": "...", "severity": "P2"}],
    "remove": ["tests-unit"],
    "skip": ["deploy-config"]
  }
}
```

**Res 200**：`{ "ok": true }`

## Loop 路由

### POST /api/loop/start

Begin auto loop.

**Res 200**：
```json
{ "status": "LOOPING" }
```

**Errors**：
- `INVALID_STATE` if session.status not in (SETUP after vision finalized, PAUSED)
- `BAD_REQUEST` if no preset chosen yet

### POST /api/loop/pause

Request pause. Current attempt finishes, then loop halts.

**Res 200**：
```json
{ "status": "PAUSING" | "PAUSED" }
```

### POST /api/loop/resume

**Res 200**：
```json
{ "status": "LOOPING" }
```

## Gaps 路由

### GET /api/gaps

**Query**：`?status=PENDING|IN_PROGRESS|DONE|SKIPPED|NEED_HUMAN|SPLIT_DONE` (optional, repeatable)
**Res 200**：
```json
{
  "gaps": [
    {
      "id": 42,
      "sessionId": 17,
      "slug": "auth-signup",
      "title": "Add user signup",
      "body": "...",
      "category": "auth",
      "severity": "P1",
      "source": "both",
      "suggestedApproach": "Use next-auth credentials...",
      "expectedFilesChanged": ["src/auth/**"],
      "status": "PENDING",
      "dynamicK": null,
      "parentGapId": null,
      "createdAt": 1747006800000,
      "finishedAt": null
    }
  ]
}
```

### POST /api/gaps/:id/skip

Mark gap SKIPPED. Cannot un-skip in MVP-0 (immutable).

**Res 200**：`{ "id": 42, "status": "SKIPPED" }`

### GET /api/gaps/:id/fixes

**Res 200**：
```json
{
  "gapId": 42,
  "fixes": [ /* Fix[] ordered by attempt asc */ ],
  "reviews": [ /* Review[] across all fixes for this gap */ ]
}
```

## Log 路由

### GET /api/log/stream

Server-Sent Events stream of `LogEvent`. Browser uses `EventSource`.

**Headers**：
```
GET /api/log/stream
Accept: text/event-stream
```

**Initial snapshot**：daemon 先推最近 100 条 log_events（按 ts asc），再切换为实时推送。

**Event format**：
```
event: log
id: 8123
data: {"id":8123,"sessionId":17,"ts":1747006811000,"level":"info","kind":"FIX_COMMITTED","payload":{"fixId":99,"gapSlug":"auth-signup","commitSha":"abc..."}}

event: heartbeat
data: {"ts": 1747006815000}
```

`heartbeat` 每 15s 一次，避免代理切断；UI 60s 未收到 heartbeat 即重连。

**断线重连**：UI 用 `Last-Event-ID` header 指定最后收到 id，daemon 从该 id 之后续推。

### GET /api/log/events

REST fallback / 历史查询。

**Query**：`?sessionId=17&since=<ts>&limit=200&level=info,warn,error`
**Res 200**：
```json
{ "events": [ /* LogEvent[] */ ], "hasMore": true }
```

## Health & meta

### GET /api/health

```json
{
  "ok": true,
  "daemonVersion": "0.1.0",
  "promptsVersion": 1,
  "claudeCli": { "found": true, "version": "claude 1.2.3" },
  "gitCli": { "found": true, "version": "git 2.45.0" },
  "dbPath": "C:\\Users\\jushi\\.d2p\\state.db",
  "uptimeMs": 12345678
}
```

### GET /api/doctor

Deep self-check (slower)：
- `claude -p "ping"` round-trip OK
- `git --version` OK
- DB write+read OK
- `.d2p-worktrees/` parent dir writable

```json
{
  "ok": false,
  "checks": [
    { "name": "claude-cli-reachable", "ok": true, "detail": "claude 1.2.3" },
    { "name": "claude-roundtrip", "ok": false, "detail": "exit 1: not logged in" },
    { "name": "git", "ok": true },
    { "name": "db", "ok": true },
    { "name": "worktree-parent-writable", "ok": true }
  ]
}
```

## Hono 路由骨架

`daemon/src/server.ts`：

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import session from './routes/session.js';
import vision from './routes/vision.js';
import loop from './routes/loop.js';
import gaps from './routes/gaps.js';
import preset from './routes/preset.js';
import detector from './routes/detector.js';
import log from './routes/log.js';
import health from './routes/health.js';

const app = new Hono();
app.use('/api/*', cors({
  origin: process.env.D2P_UI_ORIGIN ?? 'http://localhost:5173',
}));
app.route('/api/session', session);
app.route('/api/vision', vision);
app.route('/api/loop', loop);
app.route('/api/gaps', gaps);
app.route('/api/preset', preset);
app.route('/api/detector', detector);
app.route('/api/log', log);
app.route('/api', health);

app.onError((err, c) => {
  // map to problem+json
  ...
});

const port = Number(process.env.D2P_DAEMON_PORT ?? 5174);
serve({ fetch: app.fetch, port });
```

## 速率与并发

- 单 session 写操作（loop start / pause / vision answer）daemon 用一个 async mutex 串行
- SSE 连接数限制 8（同 session）
- POST body 体积上限 256KB；preset-overrides 单独 1MB

## 客户端 (UI) 调用层

`ui/src/api.ts` 提供：

```ts
export async function startSession(demoPath: string): Promise<StartSessionRes>;
export async function getCurrentSession(): Promise<CurrentSessionRes>;
export async function endSession(): Promise<{...}>;
export async function getVisionRound(): Promise<VisionRoundRes>;
export async function answerVision(answers: {questionId: string; answer: string}[]): Promise<VisionRoundRes>;
export async function finalizeVision(): Promise<VisionRoundRes>;
export async function runDetector(): Promise<DetectorOutput>;
export async function choosePreset(type: ProjectType): Promise<{type: string; presetMd: string}>;
export async function getCurrentPreset(): Promise<{...}>;
export async function savePresetOverrides(overrides: PresetOverrides): Promise<{ok: true}>;
export async function startLoop(): Promise<{status: SessionStatus}>;
export async function pauseLoop(): Promise<{status: SessionStatus}>;
export async function resumeLoop(): Promise<{status: SessionStatus}>;
export async function listGaps(filter?: {status?: GapStatus[]}): Promise<GapsListRes>;
export async function skipGap(id: number): Promise<{...}>;
export async function getGapFixes(id: number): Promise<{...}>;
export function openLogStream(onEvent: (e: SseEnvelope) => void): () => void;  // 返 disconnect 函数
export async function getHealth(): Promise<{...}>;
export async function runDoctor(): Promise<{...}>;
```
