'use client';

import { ButtonLink } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';

export function NotFoundView() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="not-found-title" className="flex flex-1 flex-col items-start justify-center gap-5 py-8">
      <p
        className="font-display text-6xl font-semibold tracking-tight text-line-strong tabular-nums"
        aria-hidden="true"
      >
        404
      </p>
      <h1 id="not-found-title" className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
        {t.notFound.title}
      </h1>
      <p className="max-w-[34rem] text-base leading-relaxed text-ink-muted">{t.notFound.description}</p>
      <ButtonLink href="/" className="mt-2">
        {t.notFound.backHome}
      </ButtonLink>
    </section>
  );
}
