export function WorkspaceB() {
  return (
    <div className="h-screen bg-ink text-cream font-mono flex flex-col pt-10">
      {/* status bar */}
      <header className="border-b border-cream/15 px-4 py-1.5 text-[11px] flex items-center justify-between bg-cream/5">
        <span><span className="text-coral">●</span> session 7 · LOOPING · 41m elapsed</span>
        <span className="text-cream/60">
          gaps <span className="text-cream">8</span> · merged <span className="text-forest">2</span> ·
          inflight <span className="text-coral">1</span> · cost <span className="text-cream">$1.27</span>
        </span>
        <span className="text-cream/40">[p]ause [s]ettings [q]uit</span>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-px bg-cream/10 overflow-hidden">
        {/* left: gap tree */}
        <aside className="col-span-3 bg-ink overflow-y-auto">
          <div className="px-3 py-2 border-b border-cream/15 text-[10px] tracking-widest text-cream/50 uppercase">gaps · 8</div>
          <ul className="text-xs">
            <Group label="INFLIGHT · 1">
              <Gap slug="add-observability-logging" sev="P1" hi />
            </Group>
            <Group label="PENDING · 3">
              <Gap slug="deploy-config-vercel" sev="P1" />
              <Gap slug="rate-limit-auth-endpoints" sev="P2" />
              <Gap slug="error-boundary-react" sev="P2" />
            </Group>
            <Group label="NEED_HUMAN · 1">
              <Gap slug="mobile-workspace-responsive" sev="P2" warn />
            </Group>
            <Group label="MERGED · 2">
              <Gap slug="add-license-mit" sev="P3" done />
              <Gap slug="env-example-template" sev="P3" done />
            </Group>
            <Group label="SPLIT · 1">
              <Gap slug="split-auth-into-tokens-sessions" sev="P1" dim />
            </Group>
          </ul>
        </aside>

        {/* center: live stream */}
        <main className="col-span-6 bg-ink overflow-y-auto">
          <div className="px-3 py-2 border-b border-cream/15 text-[10px] tracking-widest text-cream/50 uppercase flex items-center justify-between">
            <span>event stream · live</span>
            <span className="text-coral">●  32 events</span>
          </div>
          <pre className="text-[11px] leading-relaxed px-3 py-2 space-y-0">
            <Ev t="00:00:00" k="SESSION_STARTED" p="D:\demos\notes-saas" />
            <Ev t="00:00:01" k="AGENT_START" p="detector/haiku" dim />
            <Ev t="00:00:04" k="TYPE_DETECTED" p="saas-web · 0.94" />
            <Ev t="00:00:05" k="PRESET_CHOSEN" p="saas-web" />
            <Ev t="00:00:11" k="VISION_FINALIZED" p="round 3" />
            <Ev t="00:00:13" k="LOOP_STARTED" p="" hi />
            <Ev t="00:00:14" k="AGENT_START" p="differ/sonnet" dim />
            <Ev t="00:00:34" k="DIFF_PRODUCED" p="+11 gaps" />
            <Ev t="00:00:35" k="GAP_PICKED" p="add-license-mit · P3" />
            <Ev t="00:00:36" k="WORKTREE_CREATED" p="fix-add-license-mit-1" dim />
            <Ev t="00:00:39" k="FIX_COMMITTED" p="a1b2c3d4e5" />
            <Ev t="00:00:40" k="STATIC_GATE_PASSED" p="" ok />
            <Ev t="00:00:48" k="ALIGNMENT_RESULT" p="score 0.97" />
            <Ev t="00:00:51" k="REVIEW_VERDICT" p="APPROVE · MEETS_GAP" ok />
            <Ev t="00:00:52" k="MERGED" p="a1b2c3d4e5" ok hi />
            <Ev t="00:00:53" k="GAP_DONE" p="add-license-mit" ok />
            <Ev t="00:01:14" k="GAP_PICKED" p="env-example-template · P3" />
            <Ev t="00:01:32" k="MERGED" p="b2c3d4e5f6" ok hi />
            <Ev t="00:01:33" k="GAP_DONE" p="env-example-template" ok />
            <Ev t="00:01:45" k="GAP_PICKED" p="add-observability-logging · P1" hi />
            <Ev t="00:01:46" k="WORKTREE_CREATED" p="fix-add-observability-logging-1" dim />
            <Ev t="00:01:48" k="AGENT_START" p="implementer/sonnet" dim />
            <Ev t="00:02:15" k="FIX_COMMITTED" p="c3d4e5f6a7" />
            <Ev t="00:02:18" k="STATIC_GATE_PASSED" p="" ok />
            <Ev t="00:02:21" k="AGENT_START" p="alignment/haiku · running…" dim active />
          </pre>
        </main>

        {/* right: now panel */}
        <aside className="col-span-3 bg-ink overflow-y-auto">
          <div className="px-3 py-2 border-b border-cream/15 text-[10px] tracking-widest text-cream/50 uppercase">current attempt</div>
          <div className="p-3 text-xs space-y-2.5">
            <div>
              <div className="text-cream/40 text-[10px] uppercase">slug</div>
              <div className="text-coral">add-observability-logging</div>
            </div>
            <div>
              <div className="text-cream/40 text-[10px] uppercase">severity / source</div>
              <div>P1 · preset</div>
            </div>
            <div>
              <div className="text-cream/40 text-[10px] uppercase">worktree</div>
              <div className="text-cream/70 break-all">.d2p-worktrees/fix-…-1</div>
            </div>
            <div>
              <div className="text-cream/40 text-[10px] uppercase">pipeline</div>
              <ul className="text-xs space-y-1 mt-1">
                <li><span className="text-forest">[✓]</span> implementer · sonnet · 27s</li>
                <li><span className="text-forest">[✓]</span> static gate · 3s</li>
                <li><span className="text-coral">[…]</span> alignment · haiku · 8s</li>
                <li><span className="text-cream/30">[ ]</span> behavioral</li>
              </ul>
            </div>
            <div className="pt-3 mt-3 border-t border-cream/15">
              <div className="text-cream/40 text-[10px] uppercase mb-1">preset</div>
              <div className="font-bold">12 / 18 <span className="text-cream/40 font-normal">· 67%</span></div>
              <div className="mt-1.5 h-1 bg-cream/10">
                <div className="h-full bg-forest" style={{ width: '67%' }} />
              </div>
            </div>
            <div>
              <div className="text-cream/40 text-[10px] uppercase mb-1">cost</div>
              <div>$1.27 · 487k in · 125k out</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li>
      <div className="px-3 py-1 bg-cream/5 text-[10px] text-cream/50 tracking-widest uppercase">{label}</div>
      <ul>{children}</ul>
    </li>
  );
}
function Gap({ slug, sev, hi, done, warn, dim }: { slug: string; sev: string; hi?: boolean; done?: boolean; warn?: boolean; dim?: boolean }) {
  const cls = hi ? 'text-coral' : done ? 'text-forest' : warn ? 'text-rust' : dim ? 'text-cream/40' : 'text-cream/85';
  return (
    <li className={`px-3 py-1.5 ${cls} hover:bg-cream/5 cursor-pointer flex items-baseline gap-2 leading-tight`}>
      <span className="text-[10px] text-cream/40 w-5 shrink-0">{sev}</span>
      <span className="truncate text-xs">{slug}</span>
    </li>
  );
}
function Ev({ t, k, p, ok, hi, dim, active }: { t: string; k: string; p: string; ok?: boolean; hi?: boolean; dim?: boolean; active?: boolean }) {
  const cls = ok ? 'text-forest' : hi ? 'text-coral' : dim ? 'text-cream/45' : 'text-cream/80';
  return (
    <div className={`${active ? 'bg-cream/5' : ''} px-1 -mx-1`}>
      <span className="text-cream/30">{t}</span>{'  '}
      <span className={cls}>{k.padEnd(22, ' ')}</span>{'  '}
      <span className="text-cream/60">{p}</span>
      {active && <span className="text-coral animate-pulse"> ▌</span>}
    </div>
  );
}
