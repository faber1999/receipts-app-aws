'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/i18n/i18n-provider';

export const MONTH_TITLE_ID = 'expenses-month-title';

export interface MonthSwitcherProps {
  monthLabel: string;
  /** False on the current month: the switcher never goes into the future. */
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** The selected month and its arrows; earlier months are always reachable. */
export function MonthSwitcher({ monthLabel, canGoForward, onPrevious, onNext }: MonthSwitcherProps) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-10 items-center justify-between gap-4 pl-1">
      {/* Announced politely so switching months is heard, not only seen. */}
      <h2
        id={MONTH_TITLE_ID}
        tabIndex={-1}
        aria-live="polite"
        className="rounded-xs font-display text-xl font-semibold tracking-tight text-balance text-ink focus-visible:outline-offset-4"
      >
        {monthLabel}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton label={t.expenses.month.previous} onClick={onPrevious}>
          <ChevronLeftIcon />
        </IconButton>
        {/*
          aria-disabled instead of disabled: stepping onto the current month must not drop
          keyboard focus, which a natively disabled button would do.
        */}
        <IconButton
          label={t.expenses.month.next}
          tooltipAlign="end"
          aria-disabled={!canGoForward}
          onClick={canGoForward ? onNext : undefined}
          className="aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-muted aria-disabled:active:scale-100"
        >
          <ChevronRightIcon />
        </IconButton>
      </div>
    </div>
  );
}
