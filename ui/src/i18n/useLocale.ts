import { useStore } from '../store.js';
import { translate } from './locale.js';

// loadInitialLocale / persistLocale live in locale.ts now (no store dep) to
// avoid the circular import store → useLocale → store.
export { loadInitialLocale, persistLocale } from './locale.js';

/** Hook for components that need the current locale + translate helper.
 *  Subscribing to store.locale forces re-render on language switch. */
export function useLocale() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  return {
    locale,
    setLocale,
    t: (key: string, vars?: Record<string, string | number>) => translate(key, locale, vars),
  };
}
