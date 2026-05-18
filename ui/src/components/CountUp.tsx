import { useEffect, useRef, useState } from 'react';

// Smoothly animates a number toward `value` using requestAnimationFrame.
// Used by KPI cells (preset done / pct / token / cost) so the figure ticks
// instead of jumping. Honors prefers-reduced-motion — falls back to instant.

export interface CountUpProps {
  value: number;
  /** ms to reach the target. Default 450 — fast enough to feel responsive,
   *  slow enough to read the tick. */
  durationMs?: number;
  /** Decimal places to render. Default 0 (integer). */
  decimals?: number;
  /** Format hook — receives the current animated number, returns the string
   *  to render. Useful for currency / suffix / thousand separators. */
  format?: (n: number) => string;
  /** Wrapper className. */
  className?: string;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(value: number, durationMs = 450): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const startTs = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const v = from + (to - from) * ease(t);
      setDisplay(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return display;
}

export function CountUp({ value, durationMs, decimals = 0, format, className }: CountUpProps) {
  const display = useCountUp(value, durationMs);
  const text = format ? format(display) : display.toFixed(decimals);
  return <span className={className}>{text}</span>;
}
