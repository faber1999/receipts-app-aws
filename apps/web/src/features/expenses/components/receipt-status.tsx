'use client';

import type { UnprocessedExpense } from '@receipts-app/contracts';
import { AlertIcon, ClockIcon } from '@/components/icons';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

export interface ReceiptStatusProps {
  status: UnprocessedExpense['status'];
  className?: string;
}

/**
 * Stands in for the merchant of a receipt that has no expense data yet.
 * PENDING shimmers while the AI reads it (static under reduced motion; the clock and the
 * words carry the state on their own). FAILED gets a quiet danger accent on the icon only.
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

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <AlertIcon className="text-danger" />
      <span className="truncate font-medium text-ink">{list.failedTitle}</span>
    </span>
  );
}
