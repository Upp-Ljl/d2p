export function WorkspaceC() {
  return (
    <div className="h-screen bg-paper flex flex-col pt-10">
      {/* Top bar — mission status */}
      <header className="border-b border-warmline bg-cream px-6 py-3 grid grid-cols-12 gap-4 items-center">
        <div className="col-span-3">
          <div className="text-[10px] uppercase tracking-widest text-muted">mission</div>
          <div className="font-mono text-sm truncate">D:\demos\notes-saas</div>
        </div>
        <div className="col-span-1"><Big label="elapsed" v="41m" /></div>
        <div className="col-span-1"><Big label="merged" v="2" color="text-forest" /></div>
        <div className="col-span-1"><Big label="inflight" v="1" color="text-coral" /></div>
        <div className="col-span-1"><Big label="queue" v="4" /></div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-muted">preset · 12 / 18</div>
          <Gauge pct={67} />
        </div>
        <div className="col-span-1"><Big label="spend" v="$1.27" /></div>
        <div className="col-span-2 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 border border-warmline text-xs rounded-md hover:border-coral">Pause ⏸</button>
          <button className="px-3 py-1.5 text-muted text-xs hover:text-ink">⚙</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left — gap board */}
        <aside className="col-span-3 card overflow-hidden flex flex-col">
          <div className="card-header text-sm flex items-center justify-between">
            <span>Gap board</span>
            <span className="text-xs text-muted">8</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Lane label="In flight" tint="coral">
              <GapCard slug="add-observability-logging" sev="P1" attempt="1/3" hot />
            </Lane>
            <Lane label="Up next" tint="default">
              <GapCard slug="deploy-config-vercel" sev="P1" />
              <GapCard slug="rate-limit-auth-endpoints" sev="P2" />
              <GapCard slug="error-boundary-react" sev="P2" />
            </Lane>
            <Lane label="Needs human" tint="rust">
              <GapCard slug="mobile-workspace-responsive" sev="P2" warn />
            </Lane>
            <Lane label="Merged" tint="forest" small>
              <GapCard slug="add-license-mit" sev="P3" done />
              <GapCard slug="env-example-template" sev="P3" done />
            </Lane>
          </div>
        </aside>

        {/* Center top — current attempt detail */}
        <section className="col-span-6 flex flex-col gap-3 overflow-hidden">
          <div className="card overflow-hidden flex-1 flex flex-col">
            <div className="card-header flex items-center justify-between">
              <span>Current attempt · <span className="text-coral font-mono text-xs">add-observability-logging</span></span>
              <span className="text-xs text-muted">attempt 1 of 3 · 38s</span>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <p className="text-sm leading-relaxed text-ink mb-4">
                Every API request should emit a JSON log with <code>request_id</code>, <code>route</code>, <code>status</code>, <code>duration_ms</code>.
              </p>
              <div className="text-[10px] uppercase tracking-widest text-muted mb-2">pipeline</div>
              <div className="space-y-2">
                <Stage n="1" name="implementer" model="sonnet" status="done" time="27s" />
                <Stage n="2" name="static gate" model="local" status="done" time="3s" />
                <Stage n="3" name="alignment review" model="haiku" status="running" time="8s" />
                <Stage n="4" name="behavioral review" model="sonnet" status="queued" />
              </div>
              <div className="mt-5 text-[10px] uppercase tracking-widest text-muted mb-2">files touched</div>
              <ul className="text-xs font-mono space-y-1 text-muted">
                <li>+ src/middleware/logger.ts (38 lines)</li>
                <li>~ src/server.ts (+4 lines)</li>
                <li>~ package.json (+1 dep · pino)</li>
              </ul>
            </div>
          </div>

          {/* Center bottom — sparkline strip */}
          <div className="card p-4 grid grid-cols-3 gap-6">
            <Spark label="merges / hour" pts={[0, 0, 1, 1, 2, 2, 2, 2]} />
            <Spark label="cost / minute" pts={[0, 0.01, 0.03, 0.04, 0.08, 0.12, 0.18, 0.26]} color="coral" />
            <Spark label="alignment score" pts={[0, 0.6, 0.92, 0.97, 0.97, 0.91, 0.93, 0.94]} color="forest" />
          </div>
        </section>

        {/* Right — live stream */}
        <aside className="col-span-3 card overflow-hidden flex flex-col">
          <div className="card-header text-sm flex items-center justify-between">
            <span>Live stream</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-coral">
              <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse" /> 32
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-[11px] font-mono leading-relaxed space-y-0">
            <Stream t="00:00:14" k="LOOP_STARTED" />
            <Stream t="00:00:34" k="DIFF_PRODUCED" p="+11" />
            <Stream t="00:00:39" k="FIX_COMMITTED" p="a1b2c3d" />
            <Stream t="00:00:52" k="MERGED" p="a1b2c3d" ok />
            <Stream t="00:01:14" k="GAP_PICKED" p="env-example" />
            <Stream t="00:01:32" k="MERGED" p="b2c3d4e" ok />
            <Stream t="00:01:45" k="GAP_PICKED" p="obs-logging" hi />
            <Stream t="00:01:46" k="WORKTREE_CREATED" />
            <Stream t="00:01:48" k="AGENT_START" p="implementer/sonnet" />
            <Stream t="00:02:15" k="FIX_COMMITTED" p="c3d4e5f" />
            <Stream t="00:02:18" k="STATIC_GATE" p="✓" ok />
            <Stream t="00:02:21" k="AGENT_START" p="alignment/haiku" active />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Big({ label, v, color }: { label: string; v: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color ?? 'text-ink'}`}>{v}</div>
    </div>
  );
}
function Gauge({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 mt-1.5 bg-paper rounded-full overflow-hidden border border-warmline">
      <div className="h-full bg-coral" style={{ width: `${pct}%` }} />
    </div>
  );
}
function Lane({ label, tint, small, children }: { label: string; tint: string; small?: boolean; children: React.ReactNode }) {
  const bg = tint === 'coral' ? 'bg-coralsoft/30' : tint === 'forest' ? 'bg-forest/10' : tint === 'rust' ? 'bg-rust/10' : 'bg-paper';
  return (
    <div className={small ? 'opacity-80' : ''}>
      <div className={`px-3 py-1 ${bg} text-[10px] uppercase tracking-wider text-muted font-medium`}>{label}</div>
      <div className="space-y-1 p-1.5">{children}</div>
    </div>
  );
}
function GapCard({ slug, sev, attempt, hot, done, warn }: { slug: string; sev: string; attempt?: string; hot?: boolean; done?: boolean; warn?: boolean }) {
  const border = hot ? 'border-coral' : done ? 'border-forest/40' : warn ? 'border-rust/40' : 'border-warmline';
  const bg = hot ? 'bg-coralsoft/50' : done ? 'bg-forest/5' : warn ? 'bg-rust/5' : 'bg-cream';
  return (
    <div className={`${bg} ${border} border rounded-md p-2.5 cursor-pointer hover:border-coral transition`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted">{sev}</span>
        {attempt && <span className="text-[10px] text-coral">{attempt}</span>}
        {done && <span className="text-[10px] text-forest">✓ merged</span>}
        {warn && <span className="text-[10px] text-rust">need human</span>}
      </div>
      <div className="text-xs font-mono text-ink mt-1 truncate">{slug}</div>
    </div>
  );
}
function Stage({ n, name, model, status, time }: { n: string; name: string; model: string; status: string; time?: string }) {
  const icon = status === 'done' ? '✓' : status === 'running' ? '⟳' : '·';
  const color = status === 'done' ? 'text-forest' : status === 'running' ? 'text-coral' : 'text-muted/60';
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${color} border border-current ${status === 'running' ? 'animate-spin' : ''}`}>{icon}</span>
      <span className="flex-1">
        <span className="text-ink">{name}</span>
        <span className="text-xs text-muted ml-2">{model}</span>
      </span>
      <span className="text-xs text-muted tabular-nums">{time ?? '—'}</span>
    </div>
  );
}
function Spark({ label, pts, color }: { label: string; pts: number[]; color?: 'coral' | 'forest' }) {
  const max = Math.max(...pts, 0.01);
  const w = 120;
  const h = 30;
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pts.length - 1)) * w} ${h - (v / max) * h}`).join(' ');
  const stroke = color === 'coral' ? '#C96442' : color === 'forest' ? '#587A4C' : '#1F1F1E';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-muted">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{pts[pts.length - 1]?.toFixed(2)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
        <path d={path} stroke={stroke} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
function Stream({ t, k, p, ok, hi, active }: { t: string; k: string; p?: string; ok?: boolean; hi?: boolean; active?: boolean }) {
  const cls = ok ? 'text-forest' : hi ? 'text-coral' : 'text-ink/85';
  return (
    <div className={`${active ? 'bg-coralsoft/30 -mx-2 px-2' : ''}`}>
      <span className="text-muted/60">{t}</span>{'  '}
      <span className={cls}>{k}</span>
      {p && <span className="text-muted ml-1">· {p}</span>}
      {active && <span className="text-coral animate-pulse"> ▌</span>}
    </div>
  );
}
