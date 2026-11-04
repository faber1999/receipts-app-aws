'use client';

import { PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';

export const ADD_EXPENSE_BUTTON_ID = 'add-expense';

export interface ExpensesHeaderProps {
  email: string;
  signingOut: boolean;
  onSignOut: () => void;
  onAdd: () => void;
  /** False until the list has loaded, so a new expense always lands in a known list. */
  canAdd: boolean;
}

export function ExpensesHeader({ email, signingOut, onSignOut, onAdd, canAdd }: ExpensesHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col gap-3">
      {/* Account: secondary, so it sits small and quiet above the task. */}
      <div className="flex min-w-0 items-center justify-end gap-1 text-sm text-ink-muted">
        <p className="min-w-0 truncate">
          <span className="sr-only sm:not-sr-only">{t.expenses.signedInAs} </span>
          <span className="font-medium text-ink">{email}</span>
        </p>
        <span aria-hidden="true" className="px-1 text-line-strong">
          ·
        </span>
        <Button variant="ghost" size="sm" static disabled={signingOut} onClick={onSignOut} className="-mr-3">
          {signingOut ? t.expenses.signingOut : t.expenses.signOut}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <h1 id="expenses-title" className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
          {t.expenses.title}
        </h1>
        <Button id={ADD_EXPENSE_BUTTON_ID} onClick={onAdd} disabled={!canAdd} className="pl-3.5">
          <PlusIcon />
          {t.expenses.addExpense}
        </Button>
      </div>
    </header>
  );
}
