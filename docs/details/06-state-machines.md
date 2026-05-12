# 06 — State Machines

> 状态机集中说明。所有合法迁移在 `daemon/src/state/transitions.ts` 表驱动，违规 throw `IllegalTransitionError`。

## Session

```
       ┌─────────┐
       │  SETUP  │← (session 创建后初始态)
       └────┬────┘
            │ vision_finalized AND preset_chosen
            ▼
      ┌───────────┐         ┌──────────┐
      │  LOOPING  │ ──────► │  PAUSED  │
      │           │ ◄────── │          │
      └─────┬─────┘         └────┬─────┘
            │ double-green       │ user clicks End
            ▼                    ▼
       ┌────────┐           ┌──────────┐
       │  DONE  │           │  ENDED   │
       └────────┘           └──────────┘
            │
            │ user clicks End
            ▼
       ┌──────────┐
       │  ENDED   │
       └──────────┘
```

| From | To | Trigger |
|---|---|---|
| SETUP | LOOPING | `/api/loop/start` (require vision_md_path set + preset_type set) |
| LOOPING | PAUSED | `/api/loop/pause` + current attempt finished |
| PAUSED | LOOPING | `/api/loop/resume` |
| LOOPING | DONE | done-check returns double-green |
| LOOPING | ENDED | `/api/session/end` (terminates immediately) |
| PAUSED | ENDED | `/api/session/end` |
| DONE | ENDED | `/api/session/end` |
| ENDED | (no out) | terminal |
| DONE | LOOPING | not allowed (session is finished; start a new one) |

**Pause 语义**：daemon 收 pause 请求时把 session.status 设 `PAUSED_REQUESTED`（隐藏中间态，DB 仍写 LOOPING + log_events 一条 `LOOP_PAUSED requested`）。loop 主循环每 tick 检查；当前 attempt 跑完（merge / drop）→ 落入 PAUSED。如果当前在 implementer 中且不能立即停，UI 显示 "Pausing... waiting for attempt to finish"。

## Gap

```
                  ┌───────────┐
   created  ────► │  PENDING  │
                  └─────┬─────┘
                        │ orchestrator picks
                        ▼
                  ┌────────────────┐
                  │  IN_PROGRESS   │
                  └──┬──┬──┬──┬────┘
                     │  │  │  │
            APPROVE  │  │  │  │  TOO_HARD
                     │  │  │  │
                     ▼  │  │  ▼
               ┌──────┐ │  │ ┌──────────────┐
               │ DONE │ │  │ │  NEED_HUMAN  │
               └──────┘ │  │ └──────────────┘
                        │  │  user skip
                        │  ▼
                        │ ┌──────────┐
                        │ │ SKIPPED  │
                        │ └──────────┘
        SCOPE_TOO_LARGE │
                        ▼
                  ┌──────────────┐
                  │  SPLIT_DONE  │ (gap 被拆，子 gap 入队)
                  └──────────────┘
```

| From | To | Trigger |
|---|---|---|
| PENDING | IN_PROGRESS | orchestrator picks this gap; first fix attempt START |
| IN_PROGRESS | DONE | fix attempt MERGED into main |
| IN_PROGRESS | NEED_HUMAN | reviewer ESCALATE reason_code=TOO_HARD after K attempts |
| IN_PROGRESS | SKIPPED | user POST /api/gaps/:id/skip |
| IN_PROGRESS | SPLIT_DONE | reviewer ESCALATE reason_code=SCOPE_TOO_LARGE → split_into populated → daemon inserts child gaps (with parent_gap_id) + this gap moves SPLIT_DONE |
| PENDING | SKIPPED | user skip before pick |
| DONE | (terminal) |  |
| SKIPPED / NEED_HUMAN / SPLIT_DONE | (terminal) |  |

**dynamic_k** 在第一次 behavioral review 时填入 gap 行；后续 attempt 用此值决定还能 retry 几次。

## Fix Attempt

更细的状态机。一次 attempt 一行 fixes：

```
STARTED
   │ implementer spawned
   ▼
IMPLEMENTING ──────────────────────┐ implementer fail (timeout / non-zero / non-JSON)
   │ implementer commit OK         │
   ▼                               ▼
STATIC_GATE_RUNNING            DROPPED (rollback fix branch, drop worktree, attempt fails)
   │                               ▲
   ├─ pass ─► ALIGNMENT_RUNNING ───┤ alignment < 0.7 OR scope_creep → RETRY → new attempt
   │              │
   │              ├─ pass ─► BEHAVIORAL_RUNNING ──┤
   │              │              │                │
   │              │              ├─ APPROVE       │ RETRY_WITH_HINTS / ROLLBACK
   │              │              │                │ → new attempt
   │              │              ▼                │
   │              │           (high-sens?)        │ ESCALATE
   │              │              │                │ → gap NEED_HUMAN / SPLIT_DONE
   │              │              ├─ yes ─►        │   (no further attempt)
   │              │              │   ADVERSARIAL_RUNNING
   │              │              │      │
   │              │              │      ├─ SAFE  ─► MERGED ✓
   │              │              │      └─ BREAK ─► RETRY → DROPPED + new attempt
   │              │              └─ no ─► MERGED ✓
   │              └─ fail ─► ALIGNMENT_FAILED ─► DROPPED, RETRY counter ++
   └─ fail ─► STATIC_GATE_FAILED ─► DROPPED, RETRY counter ++
```

| Fix.status | 触发上一步 |
|---|---|
| `STARTED` | row inserted |
| `IMPLEMENTING` | claude implementer spawned |
| `STATIC_GATE_RUNNING` | implementer success |
| `STATIC_GATE_FAILED` | check command non-zero |
| `ALIGNMENT_RUNNING` | static gate passed |
| `ALIGNMENT_FAILED` | alignment < 0.7 or scope creep |
| `BEHAVIORAL_RUNNING` | alignment passed |
| `BEHAVIORAL_FAILED` | verdict in (RETRY_WITH_HINTS, ROLLBACK, ESCALATE) |
| `ADVERSARIAL_RUNNING` | behavioral APPROVE + high-sens gap |
| `ADVERSARIAL_FAILED` | any_break = true |
| `MERGED` | merge success |
| `DROPPED` | any failure → rollback attempt; new attempt may follow if within K |

**RETRY 决策**（在 `BEHAVIORAL_FAILED` / `ADVERSARIAL_FAILED` / `ALIGNMENT_FAILED` / `STATIC_GATE_FAILED` 后）：

```
if attempts_so_far < K (= gap.dynamic_k ?? clamp(difficulty,1,3))
   and last reason != TOO_HARD
   and last reason != ARCHITECTURAL
   and last reason != SCOPE_TOO_LARGE
then: spawn new attempt (attempt = prev + 1) with retry_hints from last review
else: terminal disposition (see escalate routing 5.5 in DEV-DOC)
```

`STATIC_GATE_FAILED` 的 hints：从 stderr_excerpt 取最后 30 行作 hints（无 AI）。
`ALIGNMENT_FAILED` 的 hints：取 alignment.concerns。

## 持久化

每次 transition daemon 在同一事务内：

```sql
UPDATE <table> SET status = ?, [other fields] WHERE id = ?;
INSERT INTO log_events (session_id, ts, level, kind, payload_json) VALUES (...);
```

事务 commit 后由 `SseHub.publish` 推 UI。

`transitions.ts` 表驱动：

```ts
const GAP_TRANSITIONS: Record<GapStatus, GapStatus[]> = {
  PENDING:     ['IN_PROGRESS', 'SKIPPED'],
  IN_PROGRESS: ['DONE', 'NEED_HUMAN', 'SKIPPED', 'SPLIT_DONE'],
  DONE: [],
  SKIPPED: [],
  NEED_HUMAN: [],
  SPLIT_DONE: [],
};
export function assertGapTransition(from: GapStatus, to: GapStatus) {
  if (!GAP_TRANSITIONS[from].includes(to)) {
    throw new IllegalTransitionError(`gap: ${from} -> ${to}`);
  }
}
// 同样有 FIX_TRANSITIONS、SESSION_TRANSITIONS
```

## 主循环伪码

`daemon/src/orchestrator/loop.ts`：

```ts
async function runLoop(sessionId: number) {
  while (true) {
    // 1. 检查 session.status (PAUSED_REQUESTED -> PAUSED)
    const session = await readSession(sessionId);
    if (session.status === 'PAUSED' || session.status === 'ENDED') return;

    // 2. 取队头 gap
    const gap = await pickHeadGap(sessionId);

    // 3. 若无 gap, 跑 done-check
    if (!gap) {
      const result = await runDoneCheck(sessionId);
      const presetGreen = await isPresetAllDone(sessionId);
      if (presetGreen && result.visionSatisfied) {
        await transitionSession(sessionId, 'DONE');
        return;
      }
      // 否则 re-run differ
      const newGaps = await runDiffer(sessionId, result.remainingThemes);
      if (newGaps.length === 0) {
        // 没新 gap 但也没双绿 → 标记并等用户
        await logEvent(sessionId, 'DONE_CHECK_RESULT', { stuck: true });
        await transitionSession(sessionId, 'PAUSED');
        return;
      }
      continue;
    }

    // 4. 跑这个 gap 的 attempts
    await transitionGap(gap.id, 'IN_PROGRESS');
    let attempt = 1;
    while (true) {
      const fix = await processFixAttempt(gap, attempt);
      if (fix.outcome === 'MERGED') {
        await transitionGap(gap.id, 'DONE');
        break;
      }
      if (fix.outcome === 'SPLIT' && fix.split) {
        await insertChildGaps(gap.id, fix.split);
        await transitionGap(gap.id, 'SPLIT_DONE');
        break;
      }
      if (fix.outcome === 'NEED_HUMAN') {
        await transitionGap(gap.id, 'NEED_HUMAN');
        break;
      }
      if (fix.outcome === 'PAUSE_LOOP') {
        await transitionSession(sessionId, 'PAUSED');
        return;
      }
      // RETRY
      const K = gap.dynamicK ?? estimateK(fix.lastReviewDifficulty);
      if (attempt >= K) {
        await transitionGap(gap.id, 'NEED_HUMAN');
        await logEvent(sessionId, 'GAP_ESCALATED', { gapId: gap.id, reason: 'K_EXHAUSTED' });
        break;
      }
      attempt++;
    }

    // 5. 回到循环顶继续
  }
}
```

`processFixAttempt` 内部按 Fix Attempt 状态机推进，所有 transition 经 `transitions.ts`。

## 重启恢复

daemon 启动时（已读 schema）：

```ts
// 1. 把所有 LOOPING session 的"半截"标记
//    - fixes status in (IMPLEMENTING, STATIC_GATE_RUNNING, ALIGNMENT_RUNNING,
//      BEHAVIORAL_RUNNING, ADVERSARIAL_RUNNING) 全 -> DROPPED, finished_at=now, error_code='DAEMON_CRASH'
//    - 对应 worktree path 用 git worktree remove --force 清理
//    - 涉及的 gap 回到 IN_PROGRESS (retry counter 不变；下次 attempt = max(prev)+1)
// 2. 把 sessions.status == LOOPING_REQUESTED (if 有这种中间态) -> PAUSED
// 3. log_events 加一条 SESSION_RESUMED 或 SESSION_CRASH_RECOVERED
// 4. 若上次 status=LOOPING 且未 paused，daemon 询问 UI 是否 auto-resume (MVP-0 不 auto-resume，要求用户点 Resume)
```
