'use client';

import type { Expense, ExpenseStatus, ProcessedExpense, ReviewExpense } from '@receipts-app/contracts';
import { PencilIcon, ReceiptIcon, TrashIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { formatMoney, type MoneyDisplay } from '@/lib/money';
import { formatLongDate, formatRowDate } from '../format';
import { type CompletableExpense, hasReceiptPhoto, isCompletable, isProcessed, uploadDay } from '../status';
import { ReceiptStatus, ReviewBadge } from './receipt-status';

export const EXPENSE_LIST_TITLE_ID = 'expense-list-title';

/** Marks each row's Review / Complete button, so other entry points can move focus to it. */
export const REVIEW_BUTTON_ATTRIBUTE = 'data-review-for';

export interface ExpenseListProps {
  monthLabel: string;
  expenses: Expense[];
  /** 'unambiguous' when the month holds more than one currency; applied to every row alike. */
  moneyDisplay: MoneyDisplay;
  /** Row that was just saved; it gets a short highlight wash. */
  highlightId: string | null;
  onHighlightEnd: () => void;
  /** Only offered on PROCESSED rows: the API edits nothing else. */
  onEdit: (expense: ProcessedExpense) => void;
  /** Offered on REVIEW ("Review") and FAILED ("Complete") rows: confirms them from the photo. */
  onReview: (expense: CompletableExpense) => void;
  onDelete: (expense: Expense) => void;
  /** Offered only on rows with a photo (uploaded receipts, whatever their status). */
  onViewReceipt: (expense: Expense) => void;
}

/** One list, two layouts: a table from md up, stacked rows below it. */
export function ExpenseList({
  monthLabel,
  expenses,
  moneyDisplay,
  highlightId,
  onHighlightEnd,
  onEdit,
  onReview,
  onDelete,
  onViewReceipt,
}: ExpenseListProps) {
  const { t, intlLocale } = useI18n();
  const { list } = t.expenses;
  // A text button joins the icons on rows to review or complete; only then does the column widen.
  const wideActions = expenses.some(isCompletable);
  const actions = { onEdit, onReview, onDelete, onViewReceipt };

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
            <col className="w-32 lg:w-36" />
            <col />
            <col className="w-32 lg:w-40" />
            <col className="w-36" />
            {/* Three 32px actions 8px apart plus the cell padding; a "Complete" button takes the first slot when needed. */}
            <col className={wideActions ? 'w-52' : 'w-36'} />
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
                ) : expense.status === 'REVIEW' ? (
                  <>
                    {/* What the AI read sits in its columns; the badge says none of it is confirmed yet. */}
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <ReviewMerchant expense={expense} />
                        <ReviewBadge />
                      </div>
                    </td>
                    <td className="truncate px-3 py-3 text-ink-muted">
                      {expense.category ? t.categories[expense.category] : <NotRead label={list.categoryNotRead} />}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <ReviewTotal expense={expense} moneyDisplay={moneyDisplay} />
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
                  <RowActions expense={expense} {...actions} />
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
              ) : expense.status === 'REVIEW' ? (
                <>
                  <p className="flex min-w-0 pt-1.5">
                    <ReviewMerchant expense={expense} />
                  </p>
                  <p className="pt-1.5 pr-1 text-right whitespace-nowrap tabular-nums">
                    <ReviewTotal expense={expense} moneyDisplay={moneyDisplay} />
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-ink-muted">
                    <time dateTime={expense.date} className="whitespace-nowrap tabular-nums">
                      {formatRowDate(expense.date, intlLocale)}
                    </time>
                    <ReviewBadge />
                    {expense.category ? (
                      <span className="truncate rounded-xs bg-surface-muted px-1.5 text-xs leading-5 text-ink-muted">
                        {t.categories[expense.category]}
                      </span>
                    ) : null}
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
              {/* A text button would squeeze the merchant line, so those rows put their actions on a line of their own. */}
              <RowActions
                expense={expense}
                {...actions}
                className={isCompletable(expense) ? 'col-span-2 pt-1' : undefined}
              />
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
function NoTotal({ status }: { status: Exclude<ExpenseStatus, 'PROCESSED'> }) {
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

/** A merchant the AI read, or a muted placeholder that says it could not. */
function ReviewMerchant({ expense }: { expense: ReviewExpense }) {
  const { t } = useI18n();

  return expense.merchant ? (
    <span className="min-w-0 truncate font-medium text-ink">{expense.merchant}</span>
  ) : (
    <span className="min-w-0 truncate text-ink-subtle">{t.expenses.list.merchantNotRead}</span>
  );
}

/** The total the AI read; without both amount and currency it is not shown (an amount alone is ambiguous). */
function ReviewTotal({ expense, moneyDisplay }: { expense: ReviewExpense; moneyDisplay: MoneyDisplay }) {
  const { intlLocale } = useI18n();

  if (expense.total === undefined || expense.currency === undefined) return <NoTotal status="REVIEW" />;
  return (
    <span className="font-medium text-ink">
      {formatMoney(expense.total, expense.currency, intlLocale, { display: moneyDisplay })}
    </span>
  );
}

/** A cell the AI left empty: a dash holds its place, and assistive tech hears why. */
function NotRead({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-ink-subtle">
        –
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

interface RowActionsProps {
  expense: Expense;
  onEdit: (expense: ProcessedExpense) => void;
  onReview: (expense: CompletableExpense) => void;
  onDelete: (expense: Expense) => void;
  onViewReceipt: (expense: Expense) => void;
  className?: string;
}

/**
 * Review / Complete first on REVIEW and FAILED rows (their main action); view receipt only when
 * there is a photo; edit only for PROCESSED; delete for every status, always last.
 * Right-aligned, so delete keeps its place whichever actions a row has.
 */
function RowActions({ expense, onEdit, onReview, onDelete, onViewReceipt, className }: RowActionsProps) {
  const { t, intlLocale } = useI18n();
  const { list } = t.expenses;
  const processed = isProcessed(expense) ? expense : null;
  const completable = isCompletable(expense) ? expense : null;
  // A merchant names the row when there is one (confirmed, or read for review); otherwise its upload day.
  const merchant = processed?.merchant ?? (expense.status === 'REVIEW' ? expense.merchant : undefined);
  const uploaded = formatLongDate(uploadDay(expense), intlLocale);
  const reviewProps = { [REVIEW_BUTTON_ATTRIBUTE]: completable?.id };

  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      {completable ? (
        <Button
          variant="secondary"
          size="sm"
          {...reviewProps}
          aria-label={
            completable.status === 'FAILED'
              ? list.completeLabel(uploaded)
              : merchant
                ? list.reviewLabel(merchant)
                : list.reviewUploadedLabel(uploaded)
          }
          onClick={() => onReview(completable)}
        >
          {completable.status === 'FAILED' ? list.complete : list.review}
        </Button>
      ) : null}
      {hasReceiptPhoto(expense) ? (
        <IconButton
          label={merchant ? list.viewReceiptLabel(merchant) : list.viewUploadedReceiptLabel(uploaded)}
          tooltip={list.viewReceipt}
          tooltipSide="top"
          onClick={() => onViewReceipt(expense)}
        >
          <ReceiptIcon />
        </IconButton>
      ) : null}
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
        label={processed ? list.deleteLabel(processed.merchant) : list.receiptDeleteLabel(uploaded)}
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
