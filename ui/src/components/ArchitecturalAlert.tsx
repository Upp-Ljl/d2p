import { useMemo } from 'react';
import type { SseEnvelope } from '../types.js';
import { useStore } from '../store.js';

/**
 * Banner shown when the loop has paused for an ARCHITECTURAL escalate.
 * Surfaces the reviewer's rationale so the user knows what decision is
 * needed before resuming.
 */
export function ArchitecturalAlert() {
  const events = useStore((s) => s.events);
  const session = useStore((s) => s.session);

  const archEvent = useMemo<SseEnvelope | undefined>(() => {
    if (session?.status !== 'PAUSED') return undefined;
    // walk back to find the most recent GAP_ESCALATED with ARCHITECTURAL
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.kind !== 'GAP_ESCALATED') continue;
      if ((e.payload as { reason?: string }).reason !== 'ARCHITECTURAL') continue;
      return e;
    }
    return undefined;
  }, [events, session?.status]);

  if (!archEvent) return null;
  const rationale = (archEvent.payload as { rationale?: string }).rationale ?? '(no rationale)';
  return (
    <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded mb-4">
      <div className="font-medium text-amber-900 mb-1">需要架构决策</div>
      <div className="text-sm text-amber-800">{rationale}</div>
      <div className="text-xs text-amber-700 mt-2">
        改一下 <code>vision.md</code> 或 <code>preset-overrides.yaml</code> 让方向更明确，d2p 会自动捕获并继续。或者点 Resume 让它再试一次。
      </div>
    </div>
  );
}
