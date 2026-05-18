import { useState } from 'react';
import { mockCommits, mockCheckpoints } from '../mock/sessions.js';

// Floating cards on a vertical timeline. No grid lines. Each commit card
// has primary actions (rewind / diff) inline + reviewer verdict chips.

function fmtRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s 前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m 前`;
  const h = Math.floor(m / 60);
  return `${h}h 前`;
}

const VERDICT_BADGE: Record<'pass' | 'fail' | 'partial', { label: string; cls: string }> = {
  pass: { label: '通过', cls: 'bg-sage-50 text-sage-600' },
  fail: { label: '未过', cls: 'bg-rust/10 text-rust' },
  partial: { label: '部分', cls: 'bg-coralsoft text-coral' },
};

const REVIEW_KIND_LABEL: Record<'alignment' | 'behavioral' | 'adversarial', string> = {
  alignment: '对题',
  behavioral: '行为',
  adversarial: '对抗',
};

export function CommitsTimeline() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rewindTarget, setRewindTarget] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto" data-testid="commits-timeline">
      <div className="flex items-baseline justify-between mb-4 px-1">
        <h2 className="text-base font-medium text-ink">Commits + Rewind</h2>
        <span className="text-xs text-muted/70 font-sans">{mockCommits.length} 次合并</span>
      </div>

      <ol className="space-y-4">
        {mockCommits.map((c, idx) => {
          const isOpen = expanded === c.sha;
          const checkpoint = mockCheckpoints.find((cp) => cp.commitSha === c.sha);
          const isLast = idx === mockCommits.length - 1;
          return (
            <li
              key={c.sha}
              className="relative pl-8 anim-stagger"
              style={{ ['--i' as 'width']: idx as unknown as string }}
              data-testid={`commit-${c.shortSha}`}
            >
              {/* Timeline dot + line */}
              <span className="absolute left-3 top-5 w-2.5 h-2.5 rounded-full bg-sage-600 ring-4 ring-sage-50" />
              {!isLast && (
                <span className="absolute left-[15px] top-9 bottom-[-16px] w-px bg-warmline" />
              )}

              <div className="bg-cream rounded-xl shadow-card ring-1 ring-warmline/60 px-5 py-4 lift-on-hover">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono text-sage-600 text-xs">{c.shortSha}</span>
                  <span className="text-sm text-ink font-medium flex-1 line-clamp-1">{c.gapTitle}</span>
                  <span className="text-[11px] text-muted/60 font-sans">{fmtRelative(c.ts)}</span>
                </div>

                <div className="text-xs text-muted/80 mb-3 line-clamp-1">{c.message}</div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] text-muted/60 font-sans">{c.filesChanged} 文件</span>
                  <span className="text-[11px] text-sage-600 font-sans">+{c.insertions}</span>
                  <span className="text-[11px] text-rust font-sans">−{c.deletions}</span>
                  <span className="flex-1" />
                  {c.reviewVerdicts.map((v, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-sans ${VERDICT_BADGE[v.verdict].cls}`}
                      title={v.score ? `score ${v.score}` : ''}
                    >
                      {REVIEW_KIND_LABEL[v.kind]} {VERDICT_BADGE[v.verdict].label}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRewindTarget(c.sha)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-coralsoft text-coral hover:bg-coral hover:text-cream transition-all duration-200 ease-out-quart font-sans font-medium"
                    data-testid={`rewind-${c.shortSha}`}
                    title="把代码库回退到这个 commit 之前"
                  >
                    ↶ 回滚到此前
                  </button>
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-lg text-muted hover:text-ink hover:bg-paper transition-colors font-sans"
                    onClick={() => setExpanded(isOpen ? null : c.sha)}
                  >
                    {isOpen ? '收起' : '看 diff'} {isOpen ? '▴' : '▾'}
                  </button>
                  {checkpoint && (
                    <span
                      className="ml-auto text-[11px] text-coral/80 font-mono"
                      title={checkpoint.description}
                    >
                      ⏱ {checkpoint.tag.replace(/^auto:/, '')}
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 pt-3 border-t border-warmline/60 text-[11px] text-muted">
                    {checkpoint && (
                      <div className="mb-1.5 text-coral/80">{checkpoint.description}</div>
                    )}
                    <div className="italic">演示模式 · 真版本会在这里渲染 diff 详情</div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {rewindTarget && (
        <RewindConfirm
          commit={mockCommits.find((c) => c.sha === rewindTarget)!}
          onCancel={() => setRewindTarget(null)}
          onConfirm={() => setRewindTarget(null)}
        />
      )}
    </div>
  );
}

function RewindConfirm({
  commit,
  onCancel,
  onConfirm,
}: {
  commit: { shortSha: string; gapTitle: string };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 anim-drift-in"
      data-testid="rewind-confirm-modal"
    >
      <div className="bg-cream rounded-2xl shadow-cardHover max-w-md w-full p-6 space-y-4 mx-4 anim-scale-in">
        <div className="text-lg font-medium text-ink">回滚到此次 commit 之前？</div>
        <div className="text-sm text-muted leading-relaxed">
          这会把 main 分支回退到 <span className="font-mono text-sage-600">{commit.shortSha}</span>{' '}
          之前的状态（gap：{commit.gapTitle}）。
          之后这个 commit 之后的所有 fix 都会丢失，但能从 checkpoint 重新跑。
        </div>
        <div className="text-xs text-muted/70 bg-paper p-3 rounded-lg">
          演示模式 · 实际不会改 git 历史
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted hover:text-ink transition-colors font-sans"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-rust text-cream rounded-lg hover:bg-rust/90 transition-colors font-sans font-medium"
          >
            确认 rewind
          </button>
        </div>
      </div>
    </div>
  );
}
