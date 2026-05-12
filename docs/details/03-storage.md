# 03 — Storage Schema

> SQLite via `better-sqlite3 ^12.9.0`. WAL 模式。DB 文件 `~/.d2p/state.db`（默认）。
> Migration 顺序写死、checksum guard、不可改已落地版本。

## DB 位置 & PRAGMA

```ts
// daemon/src/storage/db.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';

export function openDatabase(): Database.Database {
  const dbPath = process.env.D2P_DB_PATH
    ?? path.join(os.homedir(), '.d2p', 'state.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  return db;
}
```

启动顺序：`ensureDir(~/.d2p/)` → `openDatabase()` → `runMigrations(db)` → `verifyChecksums(db)`。

## Migration runner

`daemon/src/storage/migrations/index.ts`：

```ts
export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  checksum: string;                 // sha256 of up.toString()
}

export const ALL_MIGRATIONS: Migration[] = [
  m001Init,
  m002Presets,
  m003Cost,
];

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version)
  );
  for (const m of ALL_MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      m.up(db);
      db.prepare(
        'INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
      ).run(m.version, m.name, m.checksum, Date.now());
    })();
  }
}

export function verifyChecksums(db: Database.Database) {
  const rows = db.prepare(
    'SELECT version, checksum FROM schema_migrations'
  ).all() as { version: number; checksum: string }[];
  for (const row of rows) {
    const expected = ALL_MIGRATIONS.find(m => m.version === row.version);
    if (!expected) throw new Error(`unknown applied migration: ${row.version}`);
    if (expected.checksum !== row.checksum) {
      throw new Error(
        `checksum drift on migration ${row.version} (${expected.name}): ` +
        `applied=${row.checksum} expected=${expected.checksum}`
      );
    }
  }
}
```

## Migration 001 — Init

`daemon/src/storage/migrations/001-init.ts`：

```sql
-- demos table
CREATE TABLE demos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  first_seen_at INTEGER NOT NULL,
  last_session_at INTEGER,
  inferred_type TEXT
);
CREATE INDEX idx_demos_path ON demos(path);

-- sessions
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demo_id INTEGER NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('SETUP','LOOPING','PAUSED','DONE','ENDED')),
  vision_md_path TEXT,
  preset_type TEXT
);
CREATE INDEX idx_sessions_demo ON sessions(demo_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- vision drafts (per-question answers during elicit)
CREATE TABLE vision_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, question_id)
);
CREATE INDEX idx_vision_drafts_session ON vision_drafts(session_id);

-- gaps
CREATE TABLE gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('P1','P2','P3')),
  source TEXT NOT NULL CHECK (source IN ('preset','vision','both')),
  suggested_approach TEXT NOT NULL,
  expected_files_changed TEXT NOT NULL,    -- JSON array
  status TEXT NOT NULL CHECK (status IN ('PENDING','IN_PROGRESS','DONE','SKIPPED','NEED_HUMAN','SPLIT_DONE')),
  dynamic_k INTEGER,
  parent_gap_id INTEGER REFERENCES gaps(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE(session_id, slug)
);
CREATE INDEX idx_gaps_session_status ON gaps(session_id, status);

-- fixes (one row per attempt)
CREATE TABLE fixes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gap_id INTEGER NOT NULL REFERENCES gaps(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  branch TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  commit_sha TEXT,
  static_gate_passed INTEGER,             -- 0/1/NULL
  alignment_score REAL,
  reviewer_verdict TEXT,
  reason_code TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'STARTED','IMPLEMENTING','STATIC_GATE_RUNNING','STATIC_GATE_FAILED',
    'ALIGNMENT_RUNNING','ALIGNMENT_FAILED','BEHAVIORAL_RUNNING','BEHAVIORAL_FAILED',
    'ADVERSARIAL_RUNNING','ADVERSARIAL_FAILED','MERGED','DROPPED'
  )),
  stderr_excerpt TEXT,
  files_changed TEXT,                     -- JSON array
  confidence REAL,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE(gap_id, attempt)
);
CREATE INDEX idx_fixes_gap ON fixes(gap_id);

-- reviews
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fix_id INTEGER NOT NULL REFERENCES fixes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('alignment','behavioral','adversarial')),
  model TEXT NOT NULL CHECK (model IN ('haiku','sonnet','opus')),
  verdict TEXT,
  hints TEXT,                             -- JSON array
  reason_code TEXT,
  difficulty INTEGER,
  split_into TEXT,                        -- JSON array of SplitGapSpec
  raw_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_reviews_fix ON reviews(fix_id);

-- log_events (event stream for UI + audit)
CREATE TABLE log_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info','warn','error')),
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL              -- always valid JSON
);
CREATE INDEX idx_log_events_session_ts ON log_events(session_id, ts);

-- runs (claude / git subproc invocations, audit)
CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  gap_id INTEGER REFERENCES gaps(id) ON DELETE SET NULL,
  fix_id INTEGER REFERENCES fixes(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  model TEXT,
  prompts_version INTEGER,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  exit_code INTEGER,
  duration_ms INTEGER,
  ok INTEGER NOT NULL CHECK (ok IN (0,1)),
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX idx_runs_session ON runs(session_id);
CREATE INDEX idx_runs_role ON runs(role, started_at DESC);
```

## Migration 002 — Presets

`daemon/src/storage/migrations/002-presets.ts`：

```sql
-- preset status snapshots (one per differ run, latest valid)
CREATE TABLE preset_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  status_json TEXT NOT NULL                -- JSON array of PresetStatusItem
);
CREATE INDEX idx_preset_status_session_ts ON preset_status_history(session_id, ts DESC);

-- session-level cached repo summary
CREATE TABLE repo_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  head_sha TEXT,
  summary_json TEXT NOT NULL
);
CREATE INDEX idx_repo_summaries_session_ts ON repo_summaries(session_id, ts DESC);
```

## Migration 003 — Cost

`daemon/src/storage/migrations/003-cost.ts`：

```sql
CREATE TABLE cost_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX idx_cost_session ON cost_records(session_id, ts);
```

## 关键查询

`daemon/src/storage/queries.ts` 把 prepared statements 集中：

```ts
// 取队头 gap（PENDING，按 severity P1>P2>P3、created_at）
SELECT * FROM gaps
WHERE session_id = ? AND status = 'PENDING'
ORDER BY
  CASE severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
  created_at ASC
LIMIT 1;

// 同 gap 下一次 attempt 序号
SELECT COALESCE(MAX(attempt), 0) + 1 AS next FROM fixes WHERE gap_id = ?;

// session 最近 N 个 log_events（SSE 初连快照）
SELECT * FROM log_events WHERE session_id = ? ORDER BY ts DESC LIMIT ?;

// 累计 cost
SELECT SUM(input_tokens) AS in_tok, SUM(output_tokens) AS out_tok
FROM cost_records WHERE session_id = ?;

// 双绿判定：当前 session 所有 gap status
SELECT status, COUNT(*) AS n FROM gaps WHERE session_id = ? GROUP BY status;
-- preset all green 由最新 preset_status_history 的 status_json 解析判断
```

## 写入语义

- 所有写在事务里（`db.transaction(...)`）
- `log_events` 写入触发 `SseHub.publish(event)`（事务 commit 后才推，避免回滚事件外泄）
- gap status 变更必须按状态机（02-types.md FixStatus、GapStatus 合法迁移），违规即 throw

## 索引选择

- `idx_gaps_session_status (session_id, status)` — 取队头 gap
- `idx_fixes_gap` — 同 gap 历次 attempt
- `idx_log_events_session_ts (session_id, ts)` — 流式拉
- `idx_runs_role (role, started_at DESC)` — 运维 / 调试
- `idx_preset_status_session_ts` — 取最新 status snapshot

## DB 体积估算

- 一个 session 大概：
  - 30 gaps × ~2KB = 60KB
  - 60 fixes × ~4KB = 240KB
  - 90 reviews × ~6KB = 540KB
  - 2000 log_events × ~0.5KB = 1MB
  - 500 runs × ~0.5KB = 250KB
  - 总计 ≈ 2MB / session
- WAL 自动 checkpoint，不需手动 VACUUM；半年清一次 `runs` / `log_events` 老 session（MVP-1+ 加 retention 设置）

## 备份 & 故障恢复

- MVP-0：用户自行备份 `~/.d2p/state.db`
- 损坏：daemon 启动时 `PRAGMA integrity_check`；fail 则启动时显警告并把损坏的库 rename `state.db.corrupted.<ts>`，新建空库（demo 路径会丢，但 worktree 还在；下次启动 d2p 时用户重选 demo 即可）
- MVP-1+：自动 daily `.bak`
