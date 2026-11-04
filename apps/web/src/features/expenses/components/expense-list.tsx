'use client';

import type { Expense } from '@receipts-app/contracts';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { formatMoney, formatRowDate } from '../format';
import { StatusBadge } from './status-badge';

export const EXPENSE_LIST_TITLE_ID = 'expense-list-title';

export interface ExpenseListProps {
  monthLabel: string;
  expenses: Expense[];
  /** Row that was just saved; it gets a short highlight wash. */
  highlightId: string | null;
  onHighlightEnd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

/** One list, two layouts: a table from md up, stacked rows below it. */
export function ExpenseList({ monthLabel, expenses, highlightId, onHighlightEnd, onEdit, onDelete }: ExpenseListProps) {
  const { t, intlLocale } = useI18n();
  const { list } = t.expenses;

  return (
    <section aria-labelledby={EXPENSE_LIST_TITLE_ID} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-1">
        {/* Focus lands here when a dialog closes after its row was removed. */}
        <h2
          id={EXPENSE_LIST_TITLE_ID}
          tabIndex={-1}
          className="rounded-xs text-lg font-semibold tracking-tight text-ink focus-visible:outline-offset-4"
        >
          {list.title}
        </h2>
        <p className="text-sm text-ink-muted tabular-nums">{list.count(expenses.length)}</p>
      </div>

      <div className="rounded-lg bg-surface shadow-md">
        {expenses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted sm:px-6">{list.emptyMonth}</p>
        ) : (
          <>
            <table className="hidden w-full table-fixed text-sm md:table">
              <caption className="sr-only">{list.caption(monthLabel)}</caption>
              <colgroup>
                <col className="w-36" />
                <col />
                <col className="w-40" />
                <col className="w-36" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th scope="col" className="py-3 pr-3 pl-6 font-medium">
                    {list.columns.date}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {list.columns.merchant}
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    {list.columns.category}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">
                    {list.columns.total}
                  </th>
                  <th scope="col" className="py-3 pr-6 pl-3">
                    <span className="sr-only">{list.columns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    onAnimationEnd={onHighlightEnd}
                    className={cn(expense.id === highlightId && 'animate-highlight')}
                  >
                    <td className="py-3 pr-3 pl-6 whitespace-nowrap text-ink-muted tabular-nums">
                      <time dateTime={expense.date}>{formatRowDate(expense.date, intlLocale)}</time>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-ink">{expense.merchant}</span>
                        <StatusBadge status={expense.status} />
                      </div>
                    </td>
                    <td className="truncate px-3 py-3 text-ink-muted">{t.categories[expense.category]}</td>
                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                      {formatMoney(expense.total, expense.currency, intlLocale)}
                    </td>
                    <td className="py-2 pr-5 pl-3">
                      <RowActions expense={expense} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  onAnimationEnd={onHighlightEnd}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 pr-3 pl-4 first:rounded-t-lg last:rounded-b-lg',
                    expense.id === highlightId && 'animate-highlight',
                  )}
                >
                  <p className="truncate pt-1.5 font-medium text-ink">{expense.merchant}</p>
                  <p className="pt-1.5 pr-1 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                    {formatMoney(expense.total, expense.currency, intlLocale)}
                  </p>
                  {/* Chips instead of a dot separator, so the line wraps cleanly at 320px. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-muted">
                    <time dateTime={expense.date} className="whitespace-nowrap tabular-nums">
                      {formatRowDate(expense.date, intlLocale)}
                    </time>
                    <span className="truncate rounded-xs bg-surface-muted px-1.5 text-xs leading-5 text-ink-muted">
                      {t.categories[expense.category]}
                    </span>
                    <StatusBadge status={expense.status} />
                  </div>
                  <RowActions expense={expense} onEdit={onEdit} onDelete={onDelete} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

interface RowActionsProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

function RowActions({ expense, onEdit, onDelete }: RowActionsProps) {
  const { t } = useI18n();
  const { list } = t.expenses;

  return (
    <div className="flex items-center justify-end gap-2">
      <IconButton
        label={list.editLabel(expense.merchant)}
        tooltip={list.edit}
        tooltipSide="top"
        onClick={() => onEdit(expense)}
      >
        <PencilIcon />
      </IconButton>
      <IconButton
        label={list.deleteLabel(expense.merchant)}
        tooltip={list.delete}
        tooltipSide="top"
        tooltipAlign="end"
        tone="danger"
        onClick={() => onDelete(expense)}
      >
        <TrashIcon />
      </IconButton>
    </div>
  );
}
