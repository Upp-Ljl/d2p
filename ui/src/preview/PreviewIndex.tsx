import { variants, type VariantTrack, type VariantPage } from './variants/index.js';

const TRACKS: { id: VariantTrack; name: string; subtitle: string; tone: string }[] = [
  {
    id: 'a',
    name: 'Editorial',
    subtitle: 'Anthropic-warm, refined',
    tone: 'large serif, narrow columns, magazine pacing, lots of whitespace',
  },
  {
    id: 'b',
    name: 'Console',
    subtitle: 'Terminal / IDE power-user',
    tone: 'monospace-heavy, dense info, ASCII dividers, dark surface accents',
  },
  {
    id: 'c',
    name: 'Mission Control',
    subtitle: 'Live-feed dashboard',
    tone: 'gauges, sparklines, multi-panel, agent stream front-and-center',
  },
];

const PAGES: { id: VariantPage; label: string }[] = [
  { id: 'landing', label: 'Landing' },
  { id: 'setup', label: 'Setup' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'done', label: 'Done' },
  { id: 'settings', label: 'Settings' },
];

export function PreviewIndex() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto py-12 px-8">
        <header className="mb-10 pb-6 border-b border-warmline">
          <div className="text-xs font-mono text-coral uppercase tracking-widest mb-2">preview gallery</div>
          <h1 className="text-4xl tracking-tight">d2p UI — 3 directions × 5 pages</h1>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed">
            All 15 designs rendered against the same rich mock data
            (8 gaps, 32 events, vision finalized, $1.27 cost, preset 12/18). Click any cell to open;
            the bar up top lets you bounce back. Pick a track or mix and match across pages.
          </p>
        </header>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-32"></th>
              {PAGES.map((p) => (
                <th key={p.id} className="text-left text-[10px] uppercase tracking-widest text-muted pb-3 font-medium">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRACKS.map((t) => (
              <tr key={t.id} className="border-t border-warmline">
                <td className="py-6 pr-4 align-top">
                  <div className="text-xs font-mono text-coral">Track {t.id.toUpperCase()}</div>
                  <div className="text-lg font-serif mt-1">{t.name}</div>
                  <div className="text-xs text-muted mt-1 leading-snug">{t.subtitle}</div>
                  <div className="text-[11px] text-muted/70 mt-2 leading-snug italic font-serif">{t.tone}</div>
                </td>
                {PAGES.map((p) => {
                  const Comp = variants[t.id][p.id];
                  const ok = !!Comp;
                  return (
                    <td key={p.id} className="py-3 pr-3 align-top">
                      <a
                        href={`?preview=${t.id}/${p.id}`}
                        className={`block aspect-[4/3] rounded-md border transition-colors ${
                          ok
                            ? 'bg-cream border-warmline hover:border-coral hover:bg-coralsoft/30'
                            : 'bg-warmline/20 border-warmline/50 pointer-events-none'
                        }`}
                      >
                        <div className="h-full flex flex-col items-center justify-center p-3 text-center">
                          <div className="text-[10px] uppercase tracking-wider text-muted font-mono">
                            {t.id}/{p.id}
                          </div>
                          <div className="text-sm text-ink mt-1">{ok ? 'open →' : 'todo'}</div>
                        </div>
                      </a>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 text-xs text-muted/70 font-serif italic">
          Production app stays at <code className="not-italic">/</code>; previews are URL-gated only.
        </div>
      </div>
    </div>
  );
}
