import { useStore } from '../store.js';
import { translate, type Locale } from './locale.js';

const STORAGE_KEY = 'd2p.locale';

export function loadInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const raw = window.localStorage?.getItem(STORAGE_KEY);
  if (raw === 'en' || raw === 'zh') return raw;
  // Honor browser language as a soft default for new users.
  const browser = (typeof navigator !== 'undefined' && navigator.language) || '';
  if (/^en/i.test(browser)) return 'en';
  return 'zh';
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore quota / private mode */
  }
}

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
