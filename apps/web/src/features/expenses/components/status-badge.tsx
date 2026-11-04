'use client';

import type { ExpenseStatus } from '@receipts-app/contracts';
import { AlertIcon, ClockIcon } from '@/components/icons';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

export interface StatusBadgeProps {
  status: ExpenseStatus;
  className?: string;
}

/** Only states that need attention get a badge; a processed expense stays quiet. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useI18n();

  if (status === 'PROCESSED') {
    return null;
  }

  const failed = status === 'FAILED';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-xs leading-4 font-medium',
        failed ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
        className,
      )}
    >
      {failed ? <AlertIcon className="size-3.5" /> : <ClockIcon className="size-3.5" />}
      {t.expenseStatus[status]}
    </span>
  );
}
