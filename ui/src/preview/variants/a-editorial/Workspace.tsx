export function WorkspaceA() {
  return (
    <div className="min-h-screen bg-paper pt-12 pb-16">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <header className="pb-6 border-b border-warmline mb-10 flex items-baseline justify-between">
          <div>
            <div className="text-xs font-mono text-coral uppercase tracking-widest">session 7 · live</div>
            <h1 className="text-3xl tracking-tight mt-1">
              Working on <span className="font-mono text-2xl text-muted">notes-saas</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-forest">
              <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" /> looping
            </span>
            <button className="text-muted hover:text-ink">Pause ⏸</button>
            <button className="text-muted hover:text-ink">Settings</button>
          </div>
        </header>

        {/* Progress reading */}
        <section className="mb-12">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3">progress</div>
          <div className="flex items-baseline gap-8 mb-4">
            <div>
              <div className="text-5xl font-serif tracking-tight">12 <span className="text-muted text-2xl">/ 18</span></div>
              <div className="text-xs text-muted mt-1">preset items satisfied</div>
            </div>
            <div>
              <div className="text-5xl font-serif tracking-tight text-coral">3</div>
              <div className="text-xs text-muted mt-1">gaps in flight</div>
            </div>
            <div>
              <div className="text-5xl font-serif tracking-tight">$1.27</div>
              <div className="text-xs text-muted mt-1">spent · 487k in · 125k out</div>
            </div>
          </div>
          <div className="h-px bg-warmline relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-coral" style={{ width: '67%' }} />
          </div>
        </section>

        {/* Active narrative */}
        <section className="mb-12">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-4">now</div>
          <div className="border-l-2 border-coral pl-6 py-1">
            <div className="text-sm font-mono text-coral mb-1">add-observability-logging · P1 · attempt 1 of 3</div>
            <h2 className="text-2xl font-serif leading-snug mb-3">
              Add structured logging for request lifecycle
            </h2>
            <p className="text-sm text-muted leading-relaxed font-serif italic">
              "Every API request should emit a JSON log with request_id, route, status, duration_ms."
            </p>
            <div className="mt-4 text-xs text-muted space-y-1.5">
              <div className="flex gap-3"><span className="text-forest w-4">✓</span> implementer · sonnet · wrote middleware/logger.ts</div>
              <div className="flex gap-3"><span className="text-forest w-4">✓</span> static gate · typecheck + tests pass</div>
              <div className="flex gap-3"><span className="text-coral w-4">…</span> alignment review · in progress (haiku)</div>
              <div className="flex gap-3 text-muted/60"><span className="w-4">·</span> behavioral · queued</div>
            </div>
          </div>
        </section>

        {/* Recent merges */}
        <section className="mb-12">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-4">recently merged</div>
          <ul className="divide-y divide-warmline">
            <li className="py-3 flex items-baseline justify-between">
              <div>
                <div className="text-sm font-mono">add-license-mit</div>
                <div className="text-xs text-muted">P3 · LICENSE</div>
              </div>
              <code className="text-xs text-muted">a1b2c3d</code>
            </li>
            <li className="py-3 flex items-baseline justify-between">
              <div>
                <div className="text-sm font-mono">env-example-template</div>
                <div className="text-xs text-muted">P3 · .env.example + README</div>
              </div>
              <code className="text-xs text-muted">b2c3d4e</code>
            </li>
          </ul>
        </section>

        {/* Queue */}
        <section>
          <div className="text-[10px] uppercase tracking-widest text-muted mb-4">queue · 4 pending</div>
          <ol className="text-sm font-serif space-y-2">
            <li className="flex items-baseline gap-3">
              <span className="text-xs text-muted w-6 font-mono">P1</span>
              <span>Vercel deploy config + GitHub Action</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="text-xs text-muted w-6 font-mono">P2</span>
              <span>Per-IP rate limiting on /auth/*</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="text-xs text-muted w-6 font-mono">P2</span>
              <span>React error boundary at root</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="text-xs text-rust w-6 font-mono">P2</span>
              <span className="text-rust">Mobile workspace responsive — needs human</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
