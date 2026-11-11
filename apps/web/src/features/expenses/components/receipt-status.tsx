'use client';

import type { ExpenseStatus } from '@receipts-app/contracts';
import { AlertIcon, ClockIcon } from '@/components/icons';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

export interface ReceiptStatusProps {
  status: Exclude<ExpenseStatus, 'PROCESSED'>;
  className?: string;
}

/**
 * The state of an uploaded receipt that is not a confirmed expense yet. Three looks, so they
 * never blur together:
 * - PENDING shimmers while the AI reads it (static under reduced motion; the clock and the
 *   words carry the state on their own).
 * - REVIEW is a warm badge beside whatever the AI read: the one state that asks for the person.
 * - FAILED gets a quiet danger accent on the icon only.
 */
export function ReceiptStatus({ status, className }: ReceiptStatusProps) {
  const { t } = useI18n();
  const { list } = t.expenses;

  if (status === 'PENDING') {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
        <ClockIcon className="text-ink-subtle" />
        <span className="t-shimmer font-medium" data-text={list.pendingTitle}>
          {list.pendingTitle}
        </span>
      </span>
    );
  }

  if (status === 'REVIEW') {
    return <ReviewBadge className={className} />;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <AlertIcon className="text-danger" />
      <span className="truncate font-medium text-ink">{list.failedTitle}</span>
    </span>
  );
}

/** "To review" pill: warning ink on its soft tint (about 5:1), a dot so it still reads without color. */
export function ReviewBadge({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft py-0.5 pr-2 pl-1.5 text-xs leading-4 font-medium whitespace-nowrap text-warning',
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {t.expenses.list.reviewTitle}
    </span>
  );
}
