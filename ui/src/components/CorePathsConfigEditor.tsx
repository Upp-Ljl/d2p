import { useState } from 'react';
import { allCorePaths, type CorePath } from '../mock/corePaths.js';

interface CorePathsConfigEditorProps {
  onClose: () => void;
}

/** Drawer editor for .d2p/core-paths.yaml.
 *  Shows user-pinned + AI-inferred globs; supports add / remove in demo mode. */
export function CorePathsConfigEditor({ onClose }: CorePathsConfigEditorProps) {
  const [paths, setPaths] = useState<CorePath[]>(allCorePaths);
  const [newGlob, setNewGlob] = useState('');
  const [aiRerunning, setAiRerunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  function removePath(glob: string) {
    setPaths((prev) => prev.filter((p) => p.glob !== glob));
  }

  function addPath() {
    const trimmed = newGlob.trim();
    if (!trimmed) return;
    if (paths.some((p) => p.glob === trimmed)) return;
    setPaths((prev) => [
      ...prev,
      { glob: trimmed, source: 'user', label: '用户手动添加' },
    ]);
    setNewGlob('');
  }

  function handleAiRerun() {
    setAiRerunning(true);
    setAiDone(false);
    // Demo: simulate 1.5s inference
    setTimeout(() => {
      setAiRerunning(false);
      setAiDone(true);
    }, 1500);
  }

  const userPinned = paths.filter((p) => p.source === 'user');
  const inferred = paths.filter((p) => p.source === 'inferred');

  return (
    <div
      className="fixed inset-0 z-50 flex anim-drift-in"
      onClick={onClose}
      data-testid="core-paths-config-editor"
    >
      <div className="flex-1 bg-ink/30" />
      <div
        className="bg-paper border-l border-warmline w-[440px] max-w-[92vw] flex flex-col shadow-xl anim-drawer-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warmline bg-cream flex-shrink-0">
          <div>
            <div className="text-sm font-medium text-ink">核心路径配置</div>
            <div className="text-[10px] text-muted/60 font-mono mt-0.5">.d2p/core-paths.yaml</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-ink px-2 py-1 rounded hover:bg-paper transition-colors"
          >
            收起 ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* User-pinned */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-widest text-muted/60 font-medium">用户标记</span>
              <span className="text-[10px] text-sage-600 font-mono">⚓ user-pinned</span>
            </div>
            <ul className="space-y-2">
              {userPinned.map((p) => (
                <li key={p.glob} className="flex items-start gap-2 group" data-testid={`core-path-row-${p.glob.replace(/[*\/]/g, '-')}`}>
                  <span className="font-mono text-xs bg-cream rounded px-2 py-1 text-ink flex-1 break-all">
                    {p.glob}
                  </span>
                  <span className="text-[10px] text-sage-600 flex-shrink-0 mt-1">⚓</span>
                  <button
                    type="button"
                    onClick={() => removePath(p.glob)}
                    className="text-[10px] text-muted/50 hover:text-rust transition-colors flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100"
                    title="移除"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* AI-inferred */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-widest text-muted/60 font-medium">AI 推断</span>
              <span className="text-[10px] text-coral font-mono">✻ inferred</span>
            </div>
            <ul className="space-y-2">
              {inferred.map((p) => (
                <li key={p.glob} className="flex items-start gap-2 group">
                  <span className="font-mono text-xs bg-cream rounded px-2 py-1 text-ink flex-1 break-all">
                    {p.glob}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0 mt-1">
                    <span className="text-[10px] text-coral">✻</span>
                    {p.hitCount && (
                      <span className="text-[9px] text-muted/50">{p.hitCount} refs</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePath(p.glob)}
                    className="text-[10px] text-muted/50 hover:text-rust transition-colors flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100"
                    title="移除"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handleAiRerun}
              disabled={aiRerunning}
              className="mt-3 text-xs text-coral hover:text-coral/80 font-sans flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              data-testid="ai-rerun-button"
            >
              {aiRerunning ? (
                <>
                  <span className="inline-block w-3 h-3 border border-coral border-t-transparent rounded-full animate-spin" />
                  推断中…
                </>
              ) : (
                <>✻ 重新让 AI 推断</>
              )}
            </button>
            {aiDone && (
              <div className="text-[10px] text-sage-600 mt-1">
                演示模式 · 推断完成（结果未真实更新）
              </div>
            )}
          </section>

          {/* Add glob */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-muted/60 font-medium mb-2">添加 glob</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGlob}
                onChange={(e) => setNewGlob(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPath()}
                placeholder="如 lib/billing/**"
                className="flex-1 font-mono text-xs bg-cream border border-warmline rounded-lg px-3 py-2 text-ink placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-coral/40"
                data-testid="new-glob-input"
              />
              <button
                type="button"
                onClick={addPath}
                className="px-3 py-2 text-xs bg-ink text-cream rounded-lg hover:bg-ink/80 transition-colors font-sans"
              >
                添加
              </button>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-warmline bg-paper/60">
          <span className="text-[10px] text-muted/60 font-mono">
            演示模式 · 改动不会写入磁盘
          </span>
        </div>
      </div>
    </div>
  );
}
