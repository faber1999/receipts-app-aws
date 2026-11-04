'use client';

import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';

export const ADD_EXPENSE_BUTTON_ID = 'add-expense';

export interface ExpensesHeaderProps {
  /** Always available: a saved expense lands in its month whether or not that month is loaded yet. */
  onAdd: () => void;
}

export function ExpensesHeader({ onAdd }: ExpensesHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <h1 id="expenses-title" className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
        {t.expenses.title}
      </h1>
      <Button id={ADD_EXPENSE_BUTTON_ID} onClick={onAdd} className="pl-3.5">
        <PlusIcon />
        {t.expenses.addExpense}
      </Button>
    </header>
  );
}
