import { useState } from 'react';
import type { CommitRisk } from '../mock/risk.js';
import { useLocale } from '../i18n/useLocale.js';

const BAND_STYLE: Record<CommitRisk['band'], { chip: string; ring: string; key: string }> = {
  low:  { chip: 'bg-sage-50 text-sage-600',                  ring: '',                         key: 'risk.low' },
  mid:  { chip: 'bg-coralsoft text-coral',                   ring: '',                         key: 'risk.mid' },
  high: { chip: 'bg-rust/10 text-rust ring-1 ring-rust/30',  ring: 'ring-2 ring-rust/40',      key: 'risk.high' },
};

interface RiskBadgeProps {
  risk: CommitRisk;
  wrapperClass?: string;
}

export function RiskBadge({ risk }: RiskBadgeProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const styles = BAND_STYLE[risk.band];
  const label = t(styles.key);

  return (
    <div className="relative" data-testid={`risk-badge-${risk.sha}`}>
      <button
        type="button"
        className={`px-2 py-0.5 rounded-full text-[11px] font-sans font-medium transition-all duration-150 ${styles.chip}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={t('risk.level', { label })}
      >
        {label}
      </button>

      {open && risk.reasons.length > 0 && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-ink text-cream rounded-xl shadow-cardHover p-3 text-[11px] w-72 anim-scale-in pointer-events-none"
          role="tooltip"
        >
          <div className="font-medium mb-2 text-cream/80 uppercase tracking-wider text-[10px]">
            {t('risk.reasons')}
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
              {t('risk.reviewHunks', { n: risk.reviewHunks.length })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function riskCardRingClass(risk: CommitRisk | undefined): string {
  if (!risk) return '';
  return BAND_STYLE[risk.band].ring;
}
