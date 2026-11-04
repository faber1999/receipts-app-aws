'use client';

import type { Expense } from '@receipts-app/contracts';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/input';
import { useI18n } from '@/i18n/i18n-provider';
import { formatMoney, type MoneyDisplay } from '@/lib/money';
import { type ExpenseErrorKey, getExpenseErrorKey } from '../errors';
import { formatLongDate } from '../format';
import { isProcessed } from '../status';

export interface DeleteExpenseDialogProps {
  open: boolean;
  /** Kept while closing so the exit animation shows the same text. */
  expense: Expense | null;
  /** Matches the list row the dialog was opened from. */
  moneyDisplay: MoneyDisplay;
  onClose: () => void;
  /** Deletes the expense; throws on failure. A 404 should be treated as success by the caller. */
  onConfirm: (expense: Expense) => Promise<void>;
  fallbackFocus: () => HTMLElement | null;
}

export function DeleteExpenseDialog({
  open,
  expense,
  moneyDisplay,
  onClose,
  onConfirm,
  fallbackFocus,
}: DeleteExpenseDialogProps) {
  const { t, intlLocale } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<ExpenseErrorKey | null>(null);
  const [errorFor, setErrorFor] = useState<string | null>(null);
  const copy = t.expenses.deleteDialog;

  // An error belongs to one attempt on one expense; opening on another starts clean.
  const visibleError = expense && errorFor === expense.id ? error : null;

  async function handleConfirm(): Promise<void> {
    if (!expense) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm(expense);
    } catch (caught: unknown) {
      setError(getExpenseErrorKey(caught, 'deleteFailed'));
      setErrorFor(expense.id);
    } finally {
      setDeleting(false);
    }
  }

  function handleClose(): void {
    setError(null);
    onClose();
  }

  // A processed expense is named by merchant and total; a receipt not read yet only by its upload date.
  const processed = expense && isProcessed(expense) ? expense : null;
  const title = processed ? copy.title(processed.merchant) : expense ? copy.receiptTitle : '';
  const description = processed
    ? copy.description(
        formatMoney(processed.total, processed.currency, intlLocale, { display: moneyDisplay }),
        formatLongDate(processed.date, intlLocale),
      )
    : expense
      ? copy.receiptDescription(formatLongDate(expense.date, intlLocale))
      : '';
  const confirmLabel = expense && !processed ? copy.confirmReceipt : copy.confirm;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      role="alertdialog"
      title={title}
      description={description}
      dismissible={!deleting}
      closeOnBackdrop
      // The least destructive choice gets focus first.
      initialFocusRef={cancelRef}
      fallbackFocus={fallbackFocus}
      className="max-w-sm"
    >
      {visibleError ? (
        <DialogBody>
          <FieldError role="alert">{t.expenses.apiErrors[visibleError]}</FieldError>
        </DialogBody>
      ) : null}
      <DialogFooter>
        <Button ref={cancelRef} variant="secondary" disabled={deleting} onClick={handleClose}>
          {copy.cancel}
        </Button>
        <Button variant="danger" disabled={deleting} onClick={handleConfirm}>
          {deleting ? copy.deleting : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
