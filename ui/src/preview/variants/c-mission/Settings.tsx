export function SettingsC() {
  return (
    <div className="min-h-screen bg-paper pt-10">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <header className="mb-8 pb-4 border-b border-warmline flex items-end justify-between">
          <div>
            <div className="text-xs font-mono text-coral uppercase tracking-widest mb-1">settings</div>
            <h1 className="text-3xl tracking-tight">Engine & integrations</h1>
          </div>
          <div className="text-xs text-muted font-mono">~/.d2p/config.json</div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* sidebar tabs */}
          <nav className="col-span-3 space-y-1 sticky top-16">
            {[
              { id: 'engine', label: 'LLM Engine', count: '1 active', active: true },
              { id: 'presets', label: 'Quick presets', count: '7 available' },
              { id: 'github', label: 'GitHub PR mode', count: 'not configured' },
              { id: 'advanced', label: 'Advanced', count: '' },
            ].map((t) => (
              <div
                key={t.id}
                className={`px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  t.active ? 'bg-coralsoft/40 border-l-2 border-coral' : 'hover:bg-paper'
                }`}
              >
                <div className="text-sm font-medium text-ink">{t.label}</div>
                {t.count && <div className="text-[10px] text-muted mt-0.5">{t.count}</div>}
              </div>
            ))}
          </nav>

          {/* content */}
          <main className="col-span-9 space-y-4">
            <section className="card">
              <div className="card-header">LLM Engine</div>
              <div className="p-5 grid grid-cols-3 gap-3">
                {[
                  { id: 'claude-cli', t: 'Claude CLI', sub: 'local claude login · free' },
                  { id: 'openai-compat', t: 'OpenAI-compat', sub: '6 providers · token plans', active: true },
                  { id: 'anthropic-api', t: 'Anthropic API', sub: 'official Messages API' },
                ].map((e) => (
                  <label
                    key={e.id}
                    className={`block p-4 rounded-md border cursor-pointer transition-colors ${
                      e.active ? 'border-coral bg-coralsoft/40' : 'border-warmline hover:border-coral/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input type="radio" name="eng" defaultChecked={e.active} readOnly className="accent-coral" />
                      <span className="text-sm font-medium">{e.t}</span>
                    </div>
                    <div className="text-[10px] text-muted font-mono">{e.id}</div>
                    <div className="text-xs text-muted mt-2">{e.sub}</div>
                  </label>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-header">Quick presets</div>
              <div className="p-5">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { n: 'MiniMax', h: 'api.minimaxi.chat', active: true },
                    { n: 'OpenRouter', h: 'openrouter.ai' },
                    { n: 'DeepSeek', h: 'api.deepseek.com' },
                    { n: 'Z.ai', h: 'open.bigmodel.cn' },
                    { n: 'Moonshot', h: 'api.moonshot.cn' },
                    { n: 'OpenAI', h: 'api.openai.com' },
                    { n: 'Qwen', h: 'dashscope.aliyuncs.com' },
                  ].map((p) => (
                    <button
                      key={p.n}
                      className={`p-3 rounded-md border text-left transition-colors ${
                        p.active ? 'border-coral bg-coralsoft/40' : 'border-warmline hover:border-coral/50'
                      }`}
                    >
                      <div className="text-sm font-medium">{p.n}</div>
                      <div className="text-[10px] text-muted font-mono mt-0.5 truncate">{p.h}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">Active configuration</div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <FieldC label="base URL" v="https://api.minimaxi.chat/v1" mono />
                <FieldC label="API key" v="••••••••••••••••" secret mono />
                <FieldC label="model · haiku" v="abab6.5s-chat" mono />
                <FieldC label="model · sonnet" v="MiniMax-M2" mono />
                <FieldC label="model · opus" v="MiniMax-M2" mono />
                <FieldC label="extraHeaders" v="{}" mono dim />
              </div>
            </section>

            <section className="card">
              <div className="card-header">GitHub PR mode <span className="text-xs text-muted ml-2 font-sans">optional</span></div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-muted leading-relaxed">
                  Fill in to switch new sessions into PR mode — d2p pushes each fix branch and opens a PR,
                  but never auto-merges. You click merge on github.com.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FieldC label="GitHub PAT" v="" placeholder="ghp_…" secret mono />
                  <FieldC label="default base branch" v="main" mono />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button className="px-4 py-2 text-sm text-muted hover:text-ink">Cancel</button>
              <button className="px-6 py-2 bg-coral text-cream text-sm rounded-md font-semibold">Save</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function FieldC({ label, v, placeholder, secret, mono, dim }: { label: string; v: string; placeholder?: string; secret?: boolean; mono?: boolean; dim?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        readOnly
        type={secret ? 'password' : 'text'}
        defaultValue={v}
        placeholder={placeholder}
        className={`input ${mono ? 'input-mono' : ''} ${dim ? 'text-muted/60' : ''}`}
      />
    </div>
  );
}
