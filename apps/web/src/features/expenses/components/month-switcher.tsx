'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/i18n/i18n-provider';

export interface MonthSwitcherProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthSwitcher({ canGoBack, canGoForward, onPrevious, onNext }: MonthSwitcherProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <IconButton label={t.expenses.month.previous} disabled={!canGoBack} onClick={onPrevious}>
        <ChevronLeftIcon />
      </IconButton>
      <IconButton label={t.expenses.month.next} tooltipAlign="end" disabled={!canGoForward} onClick={onNext}>
        <ChevronRightIcon />
      </IconButton>
    </div>
  );
}
