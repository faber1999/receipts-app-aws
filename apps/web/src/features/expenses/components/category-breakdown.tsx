'use client';

import { useI18n } from '@/i18n/i18n-provider';
import { formatMoney, formatPercent } from '../format';
import type { CategoryTotal } from '../month';

export interface CategoryBreakdownProps {
  categories: CategoryTotal[];
  currency: string;
  /** Labels the list for assistive tech, e.g. "By category". */
  labelId: string;
}

/**
 * Totals by category as a bar list. The amount and share are always printed;
 * the bar only repeats them visually (aria-hidden), so nothing depends on color or length.
 */
export function CategoryBreakdown({ categories, currency, labelId }: CategoryBreakdownProps) {
  const { t, intlLocale } = useI18n();

  return (
    <ul aria-labelledby={labelId} className="flex flex-col gap-3.5">
      {categories.map(({ category, total, share }) => {
        const percent = formatPercent(share, intlLocale);
        return (
          <li key={category} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{t.categories[category]}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-ink">{formatMoney(total, currency, intlLocale)}</span>
                <span className="ml-2 inline-block min-w-[4ch] text-right text-ink-muted">
                  <span aria-hidden="true">{percent}</span>
                  <span className="sr-only">{t.expenses.summary.shareOfTotal(percent)}</span>
                </span>
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-(--duration-fast) ease-smooth-out"
                // A visible sliver for tiny shares, so every listed category has a bar.
                style={{ width: `max(${(share * 100).toFixed(2)}%, 4px)` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
