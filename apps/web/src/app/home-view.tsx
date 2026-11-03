'use client';

import { ButtonLink } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';

export function HomeView() {
  const { t } = useI18n();

  return (
    <div className="grid flex-1 items-center gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-16">
      <section aria-labelledby="home-title" className="flex flex-col items-start">
        <h1
          id="home-title"
          className="animate-rise font-display text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-ink sm:text-5xl"
        >
          {t.home.title}
        </h1>
        <p className="mt-5 max-w-[34rem] animate-rise text-lg leading-relaxed text-ink-muted [animation-delay:var(--duration-stagger)]">
          {t.home.description}
        </p>
        <div className="mt-8 flex w-full animate-rise flex-col gap-3 [animation-delay:calc(var(--duration-stagger)*2)] sm:w-auto sm:flex-row">
          <ButtonLink href="/sign-up" size="lg">
            {t.home.createAccount}
          </ButtonLink>
          <ButtonLink href="/sign-in" size="lg" variant="secondary">
            {t.home.signIn}
          </ButtonLink>
        </div>
      </section>

      <ReceiptPreview />
    </div>
  );
}

/** Static illustration of an extracted receipt; mirrors the real expense data model. */
function ReceiptPreview() {
  const { t, intlLocale } = useI18n();
  const preview = t.home.preview;
  const money = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: preview.currency });

  const fields = [
    { label: preview.merchantLabel, value: preview.merchant },
    { label: preview.dateLabel, value: preview.date },
  ];

  return (
    <figure className="mx-auto w-full max-w-sm animate-rise [animation-delay:calc(var(--duration-stagger)*3)] md:mx-0 md:justify-self-end">
      {/* drop-shadow lives on the wrapper because the mask below clips box-shadow */}
      <div className="receipt-shadow">
        <div className="receipt-edge rounded-t-lg bg-surface px-6 pt-6 pb-9">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">{preview.heading}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-ink">
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              {preview.status}
            </span>
          </div>

          <dl className="mt-5 divide-y divide-dashed divide-line border-y border-dashed border-line">
            {fields.map((field) => (
              <div key={field.label} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-ink-muted">{field.label}</dt>
                <dd className="text-right text-sm font-medium text-ink">{field.value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-ink-muted">{preview.categoryLabel}</dt>
              <dd>
                <span className="rounded-sm bg-surface-muted px-2 py-0.5 text-sm font-medium text-ink">
                  {preview.category}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-ink">{preview.totalLabel}</p>
            <p className="font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">
              {money.format(preview.total)}
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-sm text-ink-muted">
        {preview.monthLabel}{' '}
        <span className="font-medium text-ink tabular-nums">{money.format(preview.monthTotal)}</span>
      </figcaption>
    </figure>
  );
}
