'use client';

import { useId } from 'react';
import { AlertIcon } from '@/components/icons';
import { useI18n } from '@/i18n/i18n-provider';
import { formatMoney } from '../format';
import type { CurrencySummary, MonthSummary } from '../month';
import { CategoryBreakdown } from './category-breakdown';
import { MonthSwitcher, type MonthSwitcherProps } from './month-switcher';

export interface MonthlySummaryProps extends MonthSwitcherProps {
  monthLabel: string;
  summary: MonthSummary;
}

export function MonthlySummary({ monthLabel, summary, ...switcher }: MonthlySummaryProps) {
  const { t } = useI18n();
  const { currencies, failedCount } = summary;
  const mixed = currencies.length > 1;

  return (
    <section aria-labelledby="summary-title" className="rounded-lg bg-surface shadow-md">
      <div className="flex items-center justify-between gap-4 border-b border-line py-3 pr-3 pl-5 sm:pl-6">
        {/* Announced politely so switching months is heard, not only seen. */}
        <h2 id="summary-title" aria-live="polite" className="text-lg font-semibold tracking-tight text-ink">
          {monthLabel}
        </h2>
        <MonthSwitcher {...switcher} />
      </div>

      {currencies.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-muted sm:px-6">{t.expenses.summary.empty}</p>
      ) : (
        <>
          {mixed ? (
            <p className="px-5 pt-4 text-sm text-ink-muted sm:px-6">{t.expenses.summary.mixedCurrencies}</p>
          ) : null}
          <div className="divide-y divide-line">
            {currencies.map((group) => (
              <CurrencyBlock key={group.currency} group={group} mixed={mixed} />
            ))}
          </div>
        </>
      )}

      {failedCount > 0 ? (
        <p className="flex items-start gap-1.5 border-t border-line px-5 py-3 text-sm text-ink-muted sm:px-6">
          <AlertIcon className="mt-0.5 text-danger" />
          {t.expenses.summary.failedExcluded(failedCount)}
        </p>
      ) : null}
    </section>
  );
}

interface CurrencyBlockProps {
  group: CurrencySummary;
  mixed: boolean;
}

function CurrencyBlock({ group, mixed }: CurrencyBlockProps) {
  const { t, intlLocale } = useI18n();
  const labelId = useId();

  return (
    <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">
          {mixed ? t.expenses.summary.totalIn(group.currency) : t.expenses.summary.totalSpent}
        </p>
        <p className="font-display text-4xl font-semibold tracking-tight text-ink tabular-nums">
          {formatMoney(group.total, group.currency, intlLocale)}
        </p>
        <p className="text-sm text-ink-muted tabular-nums">{t.expenses.summary.expenseCount(group.count)}</p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 id={labelId} className="text-sm font-medium text-ink-muted">
          {t.expenses.summary.byCategory}
        </h3>
        <CategoryBreakdown categories={group.categories} currency={group.currency} labelId={labelId} />
      </div>
    </div>
  );
}
