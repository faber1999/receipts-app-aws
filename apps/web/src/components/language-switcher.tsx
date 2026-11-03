'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { LOCALES } from '@/i18n/config';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

/**
 * Segmented EN/ES control. The choice is remembered in localStorage.
 * The selected option carries a line-strong ring (>= 3:1 against the track and
 * the pill) so selection never relies on the shadow or text color alone.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <fieldset className="inline-flex min-w-0 rounded-md border-0 bg-surface-muted p-0.5">
      <legend className="sr-only">{t.languageSwitcher.label}</legend>
      {LOCALES.map((option, index) => {
        const selected = option === locale;
        const name = t.languageSwitcher.options[option];
        return (
          <Tooltip
            key={option}
            // The hint repeats the aria-label, so it is visual only (describe off).
            describe={false}
            // The last option sits against the right edge of the header: anchor its bubble to the end.
            align={index === LOCALES.length - 1 ? 'end' : 'center'}
            content={<span lang={option}>{name}</span>}
          >
            <button
              type="button"
              lang={option}
              // Visible text stays EN/ES; the name is the full language (contains the visible label, SC 2.5.3).
              aria-label={name}
              aria-pressed={selected}
              onClick={() => setLocale(option)}
              className={cn(
                'relative h-8 min-w-10 rounded-sm px-2 text-xs font-semibold tracking-wide uppercase',
                'transition-[background-color,color,box-shadow] duration-(--duration-quick) ease-standard',
                'after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""]',
                selected
                  ? 'bg-surface text-ink shadow-xs ring-1 ring-line-strong ring-inset'
                  : 'text-ink-muted hover:bg-surface hover:text-ink',
              )}
            >
              {option}
            </button>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
