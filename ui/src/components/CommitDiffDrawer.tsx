import { useState } from 'react';
import type { FileDiff } from '../mock/diff.js';
import type { CommitRisk } from '../mock/risk.js';
import { ReviewHintBanner } from './ReviewHintBanner.js';

// Status → icon + colour
const STATUS_ICON: Record<string, { icon: string; cls: string }> = {
  A: { icon: 'A', cls: 'text-sage-600' },
  M: { icon: 'M', cls: 'text-coral' },
  D: { icon: 'D', cls: 'text-rust' },
  R: { icon: 'R', cls: 'text-forest' },
};

// Diff line type → background colour
const LINE_BG: Record<string, string> = {
  add: 'bg-sage-50/70',
  del: 'bg-rust/10',
  ctx: '',
};
const LINE_TEXT: Record<string, string> = {
  add: 'text-sage-600',
  del: 'text-rust',
  ctx: 'text-muted/70',
};
const LINE_GUTTER_PREFIX: Record<string, string> = {
  add: '+',
  del: '-',
  ctx: ' ',
};

interface CommitDiffDrawerProps {
  sha: string;
  message: string;
  files: FileDiff[];
  risk?: CommitRisk;
  onClose: () => void;
}

/** Right-side diff drawer. Shows file tree on left, hunk-level diff on right. */
export function CommitDiffDrawer({ sha, message, files, risk, onClose }: CommitDiffDrawerProps) {
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? '');
  const selectedFile = files.find((f) => f.path === selectedPath) ?? files[0];

  return (
    <div
      className="fixed inset-0 z-50 flex anim-drift-in"
      onClick={onClose}
      data-testid="commit-diff-drawer"
    >
      {/* Scrim */}
      <div className="flex-1 bg-ink/30" />

      {/* Panel */}
      <div
        className="bg-paper border-l border-warmline w-[780px] max-w-[90vw] flex flex-col shadow-xl anim-drawer-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-warmline bg-cream flex-shrink-0">
          <span className="font-mono text-xs text-sage-600">{sha.slice(0, 7)}</span>
          <span className="text-sm text-ink font-medium flex-1 truncate">{message}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-ink transition-colors font-sans ml-2 px-2 py-1 rounded hover:bg-paper"
            aria-label="关闭 diff 抽屉"
          >
            收起 ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* File tree — left 240px */}
          <aside className="w-60 flex-shrink-0 border-r border-warmline bg-paper overflow-y-auto py-2">
            {files.length === 0 ? (
              <div className="px-4 py-6 text-xs text-muted/60 italic">无文件变更</div>
            ) : (
              <ul>
                {files.map((f) => {
                  const isSelected = f.path === selectedPath;
                  const statusInfo = STATUS_ICON[f.status] ?? STATUS_ICON['M'] ?? { icon: 'M', cls: 'text-coral' };
                  const fname = f.path.split('/').pop() ?? f.path;
                  const fdir = f.path.split('/').slice(0, -1).join('/');
                  return (
                    <li key={f.path}>
                      <button
                        type="button"
                        className={`w-full text-left px-4 py-2 flex items-start gap-2 transition-colors ${
                          isSelected
                            ? 'bg-coralsoft/50 border-r-2 border-coral'
                            : 'hover:bg-paper/80'
                        }`}
                        onClick={() => setSelectedPath(f.path)}
                        data-testid={`file-tree-item-${f.path.replace(/\//g, '-')}`}
                      >
                        <span className={`font-mono text-[10px] font-bold mt-0.5 flex-shrink-0 ${statusInfo.cls}`}>
                          {statusInfo.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          {fdir && (
                            <span className="block text-[10px] text-muted/50 truncate">{fdir}/</span>
                          )}
                          <span className="block text-xs text-ink truncate font-medium">{fname}</span>
                          {!f.binary && (
                            <span className="text-[10px] font-sans">
                              <span className="text-sage-600">+{f.insertions}</span>
                              {' '}
                              <span className="text-rust">-{f.deletions}</span>
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Diff view — right */}
          <div className="flex-1 overflow-y-auto flex flex-col p-4">
            {risk && risk.reviewHunks.length > 0 && (
              <ReviewHintBanner reviewHunks={risk.reviewHunks} />
            )}

            {!selectedFile ? (
              <div className="text-xs text-muted/60 italic m-auto">选择左侧文件查看 diff</div>
            ) : selectedFile.binary ? (
              <div className="bg-cream rounded-lg px-4 py-6 text-xs text-muted/70 text-center">
                binary file changed
              </div>
            ) : (
              <div className="font-mono text-[11px] rounded-lg overflow-hidden border border-warmline/60">
                {/* File path bar */}
                <div className="bg-cream px-4 py-2 border-b border-warmline/60 text-xs text-muted font-sans flex items-center justify-between">
                  <span className="font-mono text-ink/80">{selectedFile.path}</span>
                  {selectedFile.oldPath && (
                    <span className="text-muted/60">← {selectedFile.oldPath}</span>
                  )}
                </div>

                {selectedFile.hunks.length === 0 ? (
                  <div className="px-4 py-4 text-muted/60 text-xs italic">no hunks</div>
                ) : (
                  selectedFile.hunks.map((hunk, hIdx) => {
                    const hunkId = `hunk-${selectedFile.path.replace(/\//g, '-')}-${hIdx}`;
                    return (
                      <div key={hIdx} id={hunkId} data-testid={hunkId}>
                        {/* Hunk header */}
                        <div className="bg-sage-50/40 text-sage-600/80 px-4 py-1 text-[10px] font-mono border-b border-warmline/40">
                          {hunk.header}
                        </div>
                        {/* Lines */}
                        {hunk.lines.map((line, lIdx) => {
                          const prefix = LINE_GUTTER_PREFIX[line.type] ?? ' ';
                          const bg = LINE_BG[line.type] ?? '';
                          const textCls = LINE_TEXT[line.type] ?? '';
                          return (
                            <div
                              key={lIdx}
                              className={`flex text-[11px] leading-relaxed ${bg}`}
                            >
                              {/* Old line number */}
                              <span className="w-10 text-right pr-2 text-muted/40 select-none flex-shrink-0 border-r border-warmline/30 py-px">
                                {line.oldLineNo ?? ''}
                              </span>
                              {/* New line number */}
                              <span className="w-10 text-right pr-2 text-muted/40 select-none flex-shrink-0 border-r border-warmline/30 py-px">
                                {line.newLineNo ?? ''}
                              </span>
                              {/* +/- prefix */}
                              <span className={`w-5 text-center flex-shrink-0 py-px select-none ${textCls}`}>
                                {prefix}
                              </span>
                              {/* Content */}
                              <span className={`flex-1 px-2 py-px whitespace-pre-wrap break-all ${textCls}`}>
                                {line.content || ' '}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
