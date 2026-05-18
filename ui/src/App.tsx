import { useEffect } from 'react';
import { bootstrap, useStore } from './store.js';
import { HealthBadge } from './components/HealthBadge.js';
import { Landing } from './pages/Landing.js';
import { Setup } from './pages/Setup.js';
import { Workspace } from './pages/Workspace.js';
import { Done } from './pages/Done.js';
import { Settings } from './pages/Settings.js';
import { Preview, readPreviewParam } from './preview/Preview.js';

export function App() {
  // Preview mode short-circuits production routing entirely — no daemon poll,
  // no SSE, no real session — so designers can iterate offline.
  const previewParam = readPreviewParam();
  useEffect(() => {
    if (previewParam) return; // skip bootstrap in preview
    return bootstrap();
  }, [previewParam]);
  if (previewParam) return <Preview />;

  const session = useStore((s) => s.session);
  const health = useStore((s) => s.health);
  const showSettings = useStore((s) => s.showSettings);
  const setShowSettings = useStore((s) => s.setShowSettings);

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  let body;
  if (!session) {
    body = <Landing />;
  } else if (session.status === 'SETUP') {
    body = <Setup />;
  } else if (session.status === 'LOOPING' || session.status === 'PAUSED') {
    body = <Workspace />;
  } else {
    body = <Done />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {(!session || session.status === 'SETUP' || session.status === 'DONE' || session.status === 'ENDED') && (
        <div className="absolute top-4 right-6 z-10 flex items-center gap-4">
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            ⚙ 设置
          </button>
          <HealthBadge />
        </div>
      )}
      {body}
      {health?.ok && !session && (
        <div className="fixed bottom-3 right-4 text-[10px] text-muted/60 font-mono">
          daemon v{health.daemonVersion} · prompts v{health.promptsVersion}
        </div>
      )}
    </div>
  );
}
