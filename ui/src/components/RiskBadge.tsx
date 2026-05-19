import { useState } from 'react';
import type { CommitRisk } from '../mock/risk.js';

// Risk band colour tokens
const BAND_STYLES: Record<CommitRisk['band'], { chip: string; ring: string; label: string }> = {
  low:  { chip: 'bg-sage-50 text-sage-600',           ring: '',                               label: '低风险' },
  mid:  { chip: 'bg-coralsoft text-coral',            ring: '',                               label: '中风险' },
  high: { chip: 'bg-rust/10 text-rust ring-1 ring-rust/30', ring: 'ring-2 ring-rust/40',     label: '高风险 · 建议看一眼' },
};

interface RiskBadgeProps {
  risk: CommitRisk;
  /** Called by consumer to get the class to add to the commit card wrapper */
  wrapperClass?: string;
}

/** Chip showing commit risk band. Hover/tap opens a popover with reasons. */
export function RiskBadge({ risk }: RiskBadgeProps) {
  const [open, setOpen] = useState(false);
  const styles = BAND_STYLES[risk.band];

  return (
    <div className="relative" data-testid={`risk-badge-${risk.sha}`}>
      <button
        type="button"
        className={`px-2 py-0.5 rounded-full text-[11px] font-sans font-medium transition-all duration-150 ${styles.chip}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`风险等级: ${styles.label}`}
      >
        {styles.label}
      </button>

      {open && risk.reasons.length > 0 && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-ink text-cream rounded-xl shadow-cardHover p-3 text-[11px] w-72 anim-scale-in pointer-events-none"
          role="tooltip"
        >
          <div className="font-medium mb-2 text-cream/80 uppercase tracking-wider text-[10px]">
            风险原因
          </div>
          <ul className="space-y-1.5">
            {risk.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-cream/90 leading-snug">
                <span className="text-rust/80 flex-shrink-0 mt-0.5">▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {risk.reviewHunks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-cream/10 text-cream/60">
              {risk.reviewHunks.length} 处建议人工确认
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Returns the ring class to apply to a commit card when risk is high */
export function riskCardRingClass(risk: CommitRisk | undefined): string {
  if (!risk) return '';
  return BAND_STYLES[risk.band].ring;
}
