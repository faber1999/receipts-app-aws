'use client';

import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/i18n/i18n-provider';

export const MAIN_CONTENT_ID = 'main-content';

export function SkipLink() {
  const { t } = useI18n();

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      // Parked above the viewport rather than sr-only: `not-sr-only` resets padding to 0,
      // which left the focused link as a bare 20px-tall box (below the 24px target size).
      className="fixed top-3 left-3 z-50 -translate-y-[calc(100%+1rem)] rounded-md bg-surface px-3 py-2 text-sm font-medium text-ink transition-transform focus:shadow-md duration-(--duration-quick) ease-smooth-out focus:translate-y-0"
    >
      {t.skipToContent}
    </a>
  );
}

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-ink no-underline"
          aria-label={t.header.homeLabel}
        >
          <BrandMark />
          <span className="text-[0.9375rem] font-semibold tracking-tight">Receipts App</span>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between sm:px-6">
        <p>Receipts App</p>
        <p>{t.footer.tagline}</p>
      </div>
    </footer>
  );
}
