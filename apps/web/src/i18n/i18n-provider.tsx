'use client';

import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, INTL_LOCALES, isLocale, LOCALE_STORAGE_KEY, type Locale } from './config';
import { type Dictionary, dictionaries } from './dictionaries';

interface I18nContextValue {
  locale: Locale;
  /** BCP 47 tag for Intl formatters, e.g. `en-US`. */
  intlLocale: string;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Storage can throw (private mode, blocked site data), so the UI must work without it.
function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Preference just won't persist.
  }
}

export interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Client-side locale: the static export always renders the default locale,
 * then switches to the visitor's saved choice after hydration.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      intlLocale: INTL_LOCALES[locale],
      t: dictionaries[locale],
      setLocale: (next) => {
        setLocaleState(next);
        storeLocale(next);
      },
    }),
    [locale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside <I18nProvider>.');
  }
  return context;
}
