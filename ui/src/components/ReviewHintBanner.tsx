import type { ReviewHunk } from '../mock/risk.js';

interface ReviewHintBannerProps {
  reviewHunks: ReviewHunk[];
}

/** Banner shown at top of CommitDiffDrawer when a commit has reviewHunks.
 *  Clicking a hint scrolls to the corresponding hunk in the diff view. */
export function ReviewHintBanner({ reviewHunks }: ReviewHintBannerProps) {
  if (reviewHunks.length === 0) return null;

  function scrollToHunk(path: string, hunkIdx: number) {
    const id = `hunk-${path.replace(/\//g, '-')}-${hunkIdx}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('hunk-highlight-flash');
      setTimeout(() => el.classList.remove('hunk-highlight-flash'), 1200);
    }
  }

  return (
    <div
      className="bg-rust/8 border border-rust/20 rounded-lg px-4 py-3 mb-3 flex-shrink-0"
      data-testid="review-hint-banner"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-rust text-sm">⚠</span>
        <span className="text-rust text-xs font-medium">
          建议你看一眼这 {reviewHunks.length} 处
        </span>
      </div>
      <ul className="space-y-1.5">
        {reviewHunks.map((h, i) => (
          <li key={i} className="flex items-start gap-2">
            <button
              type="button"
              className="flex items-start gap-2 text-left hover:bg-rust/10 rounded px-1.5 py-0.5 transition-colors w-full group"
              onClick={() => scrollToHunk(h.path, h.hunkIdx)}
            >
              <span className="font-mono text-[10px] text-rust/80 mt-0.5 flex-shrink-0 group-hover:text-rust">
                {h.path.split('/').pop()}:{h.hunkIdx + 1}
              </span>
              <span className="text-[11px] text-muted/90 leading-snug">{h.reason}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
