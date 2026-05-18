import { useEffect } from 'react';
import { useStore } from '../store.js';
import { mockStoreFor } from '../mock/data.js';
import { PreviewIndex } from './PreviewIndex.js';
import { variants, type VariantTrack, type VariantPage } from './variants/index.js';

/** Parses ?preview=track/page or ?preview=index. Returns null if disabled. */
export function readPreviewParam(): { track: VariantTrack; page: VariantPage } | 'index' | null {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const v = sp.get('preview');
  if (!v) return null;
  if (v === 'index' || v === '1' || v === 'true') return 'index';
  const [track, page] = v.split('/');
  if (!track || !page) return 'index';
  if (!['a', 'b', 'c'].includes(track)) return 'index';
  if (!['landing', 'setup', 'workspace', 'done', 'settings'].includes(page)) return 'index';
  return { track: track as VariantTrack, page: page as VariantPage };
}

/** Top-level preview shell. Fills the Zustand store with mock data before
 *  rendering the variant, so individual variant components stay simple and
 *  read from useStore as if a real daemon were behind them. */
export function Preview() {
  const param = readPreviewParam();

  useEffect(() => {
    if (!param || param === 'index') {
      useStore.setState(mockStoreFor({ empty: true }));
      return;
    }
    // Choose mock state appropriate to the page
    const { page } = param;
    if (page === 'landing') {
      useStore.setState(mockStoreFor({ empty: true }));
    } else if (page === 'setup') {
      useStore.setState({ ...mockStoreFor({ status: 'SETUP' }), gaps: [], events: [] });
    } else if (page === 'workspace') {
      useStore.setState(mockStoreFor({ status: 'LOOPING' }));
    } else if (page === 'done') {
      useStore.setState(mockStoreFor({ status: 'DONE' }));
    } else if (page === 'settings') {
      useStore.setState(mockStoreFor({ empty: true }));
    }
  }, [param && param !== 'index' ? param.track + '/' + param.page : 'index']);

  if (!param) return null;
  if (param === 'index') return <PreviewIndex />;
  const Component = variants[param.track][param.page];
  return (
    <div>
      <PreviewToolbar track={param.track} page={param.page} />
      <Component />
    </div>
  );
}

function PreviewToolbar({ track, page }: { track: VariantTrack; page: VariantPage }) {
  const trackName = { a: 'Editorial', b: 'Console', c: 'Mission Control' }[track];
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-ink text-cream text-xs px-4 py-1.5 flex items-center justify-between font-mono">
      <span>
        <a href="?preview=index" className="text-cream hover:text-coral">← all variants</a>
        <span className="mx-2 text-cream/40">·</span>
        <span className="text-cream/70">track</span> <strong>{track.toUpperCase()} {trackName}</strong>
        <span className="mx-2 text-cream/40">·</span>
        <span className="text-cream/70">page</span> <strong>{page}</strong>
      </span>
      <span className="text-cream/40">
        preview — mock data, no daemon
      </span>
    </div>
  );
}
