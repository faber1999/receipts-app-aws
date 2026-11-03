export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'receipts:locale';

/** BCP 47 tags used for Intl number and date formatting. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-CO',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
