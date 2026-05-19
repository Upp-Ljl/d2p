import type { CorePathHit } from '../mock/corePaths.js';

interface CorePathsAlertProps {
  hits: CorePathHit[];
  onAllow: () => void;
  onVeto: () => void;
}

/** Modal shown when an implementer commit touches a core-path glob.
 *  In demo mode the buttons don't actually block anything. */
export function CorePathsAlert({ hits, onAllow, onVeto }: CorePathsAlertProps) {
  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 anim-drift-in"
      data-testid="core-paths-alert"
    >
      <div
        className="bg-cream rounded-2xl shadow-cardHover max-w-lg w-full mx-4 flex flex-col anim-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="px-6 pt-5 pb-4 border-b border-warmline">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-rust text-base">⚠</span>
            <h2 className="text-base font-medium text-ink">
              动了 {hits.length} 处核心代码 · 需要你确认
            </h2>
          </div>
          <p className="text-xs text-muted/80 leading-relaxed">
            本次 commit 命中了你标记的核心路径。合并前请确认变更符合预期。
          </p>
        </div>

        {/* Hit list */}
        <div className="flex-1 overflow-y-auto max-h-80 px-6 py-4 space-y-4">
          {hits.map((hit, i) => (
            <div key={i} className="rounded-lg border border-warmline/60 overflow-hidden">
              {/* Hit header */}
              <div className="bg-paper px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs text-ink font-medium">{hit.changedPath}</span>
                <span className="font-mono text-[10px] text-muted/60 bg-warmline/50 px-2 py-0.5 rounded">
                  glob: {hit.matchedGlob}
                </span>
                <span className="ml-auto text-[11px] font-sans">
                  <span className="text-sage-600">+{hit.insertions}</span>
                  {' '}
                  <span className="text-rust">-{hit.deletions}</span>
                </span>
              </div>
              {/* Diff preview */}
              {hit.diffPreview.length > 0 && (
                <div className="font-mono text-[10px] bg-paper/50 px-4 py-2 border-t border-warmline/40">
                  {hit.diffPreview.map((line, li) => {
                    const isAdd = line.startsWith('+');
                    const isDel = line.startsWith('-');
                    return (
                      <div
                        key={li}
                        className={`leading-relaxed ${isAdd ? 'text-sage-600 bg-sage-50/50' : isDel ? 'text-rust bg-rust/5' : 'text-muted/70'}`}
                      >
                        {line}
                      </div>
                    );
                  })}
                  <div className="text-muted/40 mt-1 italic text-[10px]">… 仅显示前 {hit.diffPreview.length} 行</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Demo note */}
        <div className="px-6 py-2 bg-paper/60 border-t border-warmline/40">
          <span className="text-[10px] text-muted/60 font-mono">演示模式 · 点击不会实际阻止 merge</span>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-warmline flex justify-end gap-3">
          <button
            type="button"
            onClick={onVeto}
            className="px-4 py-2 text-sm font-sans font-medium text-rust border border-rust/30 rounded-lg hover:bg-rust/10 transition-colors"
            data-testid="core-paths-veto"
          >
            否决（不 merge）
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="px-4 py-2 text-sm font-sans font-medium bg-sage-600 text-cream rounded-lg hover:bg-sage-600/90 transition-colors"
            data-testid="core-paths-allow"
          >
            允许 merge
          </button>
        </div>
      </div>
    </div>
  );
}
