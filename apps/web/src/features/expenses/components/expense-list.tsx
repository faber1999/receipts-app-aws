'use client';

import type { Expense, ProcessedExpense, UnprocessedExpense } from '@receipts-app/contracts';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { formatMoney, type MoneyDisplay } from '@/lib/money';
import { formatLongDate, formatRowDate } from '../format';
import { isProcessed } from '../status';
import { ReceiptStatus } from './receipt-status';

export const EXPENSE_LIST_TITLE_ID = 'expense-list-title';

export interface ExpenseListProps {
  monthLabel: string;
  expenses: Expense[];
  /** 'unambiguous' when the month holds more than one currency; applied to every row alike. */
  moneyDisplay: MoneyDisplay;
  /** Row that was just saved; it gets a short highlight wash. */
  highlightId: string | null;
  onHighlightEnd: () => void;
  /** Only offered on PROCESSED rows: an unprocessed receipt has nothing to edit yet. */
  onEdit: (expense: ProcessedExpense) => void;
  onDelete: (expense: Expense) => void;
}

/** One list, two layouts: a table from md up, stacked rows below it. */
export function ExpenseList({
  monthLabel,
  expenses,
  moneyDisplay,
  highlightId,
  onHighlightEnd,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  const { t, intlLocale } = useI18n();
  const { list } = t.expenses;

  return (
    <section aria-labelledby={EXPENSE_LIST_TITLE_ID} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-1">
        {/* Focus lands here when a dialog closes after its row was removed. */}
        <h3
          id={EXPENSE_LIST_TITLE_ID}
          tabIndex={-1}
          className="rounded-xs text-lg font-semibold tracking-tight text-ink focus-visible:outline-offset-4"
        >
          {list.title}
        </h3>
        <p className="text-sm text-ink-muted tabular-nums">{list.count(expenses.length)}</p>
      </div>

      <div className="rounded-lg bg-surface shadow-md">
        {/* The workspace shows the month's empty state instead of an empty list. */}
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
                {isProcessed(expense) ? (
                  <>
                    <td className="truncate px-3 py-3 font-medium text-ink">{expense.merchant}</td>
                    <td className="truncate px-3 py-3 text-ink-muted">{t.categories[expense.category]}</td>
                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                      {formatMoney(expense.total, expense.currency, intlLocale, { display: moneyDisplay })}
                    </td>
                  </>
                ) : (
                  <>
                    {/* No merchant or category yet: the status spans both; date, total and actions keep their columns. */}
                    <td colSpan={2} className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ReceiptStatus status={expense.status} />
                        {expense.status === 'FAILED' ? (
                          <span className="min-w-0 truncate text-ink-muted">{list.failedHint}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <NoTotal status={expense.status} />
                    </td>
                  </>
                )}
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
              {isProcessed(expense) ? (
                <>
                  <p className="truncate pt-1.5 font-medium text-ink">{expense.merchant}</p>
                  <p className="pt-1.5 pr-1 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                    {formatMoney(expense.total, expense.currency, intlLocale, { display: moneyDisplay })}
                  </p>
                  {/* Chips instead of a dot separator, so the line wraps cleanly at 320px. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-muted">
                    <time dateTime={expense.date} className="whitespace-nowrap tabular-nums">
                      {formatRowDate(expense.date, intlLocale)}
                    </time>
                    <span className="truncate rounded-xs bg-surface-muted px-1.5 text-xs leading-5 text-ink-muted">
                      {t.categories[expense.category]}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 pt-1.5">
                    <ReceiptStatus status={expense.status} />
                  </div>
                  <p className="pt-1.5 pr-1 text-right">
                    <NoTotal status={expense.status} />
                  </p>
                  <div className="flex min-w-0 flex-col gap-0.5 text-sm text-ink-muted">
                    <time dateTime={expense.date} className="whitespace-nowrap tabular-nums">
                      {formatRowDate(expense.date, intlLocale)}
                    </time>
                    {expense.status === 'FAILED' ? <span>{list.failedHint}</span> : null}
                  </div>
                </>
              )}
              <RowActions expense={expense} onEdit={onEdit} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Total cell of a receipt with no amount yet: a dash holds the column's right edge,
 * and assistive tech hears why it is empty.
 */
function NoTotal({ status }: { status: UnprocessedExpense['status'] }) {
  const { t } = useI18n();

  return (
    <>
      <span aria-hidden="true" className="text-ink-subtle">
        –
      </span>
      <span className="sr-only">{t.expenses.list.noTotal[status]}</span>
    </>
  );
}

interface RowActionsProps {
  expense: Expense;
  onEdit: (expense: ProcessedExpense) => void;
  onDelete: (expense: Expense) => void;
}

/** Edit only for PROCESSED; delete for every status. Right-aligned, so delete keeps its place either way. */
function RowActions({ expense, onEdit, onDelete }: RowActionsProps) {
  const { t, intlLocale } = useI18n();
  const { list } = t.expenses;
  const processed = isProcessed(expense) ? expense : null;

  return (
    <div className="flex items-center justify-end gap-2">
      {processed ? (
        <IconButton
          label={list.editLabel(processed.merchant)}
          tooltip={list.edit}
          tooltipSide="top"
          onClick={() => onEdit(processed)}
        >
          <PencilIcon />
        </IconButton>
      ) : null}
      <IconButton
        label={
          processed
            ? list.deleteLabel(processed.merchant)
            : list.receiptDeleteLabel(formatLongDate(expense.date, intlLocale))
        }
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
