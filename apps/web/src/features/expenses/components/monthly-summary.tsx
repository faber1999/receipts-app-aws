'use client';

import { useId } from 'react';
import { AlertIcon, ClockIcon } from '@/components/icons';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { formatMoney, type MoneyDisplay, moneyDisplayFor } from '@/lib/money';
import type { CurrencySummary, MonthSummary } from '../month';
import { CategoryBreakdown } from './category-breakdown';

export interface MonthlySummaryProps {
  /** Totals of the selected month; the month itself is named by the switcher above. */
  summary: MonthSummary;
  /** Opens the first receipt waiting for review (offered while there is one). */
  onReview: () => void;
}

export function MonthlySummary({ summary, onReview }: MonthlySummaryProps) {
  const { t } = useI18n();
  const { currencies, pendingCount, reviewCount, failedCount } = summary;
  const mixed = currencies.length > 1;
  const display = moneyDisplayFor(currencies.map((group) => group.currency));
  const copy = t.expenses.summary;

  return (
    <section aria-label={copy.label} className="rounded-lg bg-surface shadow-md">
      {currencies.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-muted sm:px-6">
          {pendingCount > 0 ? copy.awaitingTotals : reviewCount > 0 ? copy.awaitingReview : copy.empty}
        </p>
      ) : (
        <>
          {mixed ? (
            <p className="px-5 pt-5 text-sm text-ink-muted sm:px-6">{t.expenses.summary.mixedCurrencies}</p>
          ) : null}
          <div className="divide-y divide-line">
            {currencies.map((group) => (
              <CurrencyBlock key={group.currency} group={group} mixed={mixed} display={display} />
            ))}
          </div>
        </>
      )}

      {/* Receipts without an amount are named, never silently dropped from the totals. */}
      {pendingCount > 0 || reviewCount > 0 || failedCount > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-line px-5 py-3 text-sm text-ink-muted sm:px-6">
          {/* First: the one note that asks something of the person, with the way to do it. */}
          {reviewCount > 0 ? (
            <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-start gap-1.5">
                <span aria-hidden="true" className="mt-1.75 size-1.5 shrink-0 rounded-full bg-warning" />
                <span className="font-medium text-ink tabular-nums">{copy.reviewNote(reviewCount)}</span>
              </span>
              <button
                type="button"
                aria-label={copy.reviewActionLabel(reviewCount)}
                onClick={onReview}
                className={cn(
                  'relative -my-1 rounded-xs px-1 py-1 font-medium text-primary-ink underline decoration-primary-ink/40 underline-offset-[0.2em]',
                  'transition-[text-decoration-color] duration-(--duration-quick) ease-standard hover:decoration-primary-ink',
                )}
              >
                {copy.reviewAction}
              </button>
            </li>
          ) : null}
          {pendingCount > 0 ? (
            <li className="flex items-start gap-1.5">
              <ClockIcon className="mt-0.5 text-ink-subtle" />
              <span className="tabular-nums">{copy.pendingNote(pendingCount)}</span>
            </li>
          ) : null}
          {failedCount > 0 ? (
            <li className="flex items-start gap-1.5">
              <AlertIcon className="mt-0.5 text-danger" />
              <span className="tabular-nums">{copy.failedNote(failedCount)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

interface CurrencyBlockProps {
  group: CurrencySummary;
  mixed: boolean;
  display: MoneyDisplay;
}

function CurrencyBlock({ group, mixed, display }: CurrencyBlockProps) {
  const { t, intlLocale } = useI18n();
  const labelId = useId();

  return (
    <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">
          {mixed ? t.expenses.summary.totalIn(group.currency) : t.expenses.summary.totalSpent}
        </p>
        <p className="font-display text-4xl font-semibold tracking-tight text-ink tabular-nums">
          {formatMoney(group.total, group.currency, intlLocale, { display })}
        </p>
        <p className="text-sm text-ink-muted tabular-nums">{t.expenses.summary.expenseCount(group.count)}</p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 id={labelId} className="text-sm font-medium text-ink-muted">
          {t.expenses.summary.byCategory}
        </h3>
        <CategoryBreakdown
          categories={group.categories}
          currency={group.currency}
          display={display}
          labelId={labelId}
        />
      </div>
    </div>
  );
}
