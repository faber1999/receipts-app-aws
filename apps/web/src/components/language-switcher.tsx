'use client';

import { LOCALES } from '@/i18n/config';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

/** Segmented EN/ES control. The choice is remembered in localStorage. */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <fieldset className="inline-flex min-w-0 rounded-md border-0 bg-surface-muted p-0.5">
      <legend className="sr-only">{t.languageSwitcher.label}</legend>
      {LOCALES.map((option) => {
        const selected = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={selected}
            title={t.languageSwitcher.options[option]}
            onClick={() => setLocale(option)}
            className={cn(
              'relative h-8 min-w-10 rounded-sm px-2 text-xs font-semibold tracking-wide uppercase',
              'transition-[background-color,color,box-shadow] duration-(--duration-quick) ease-standard',
              'after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""]',
              selected ? 'bg-surface text-ink shadow-xs' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option}
          </button>
        );
      })}
    </fieldset>
  );
}
