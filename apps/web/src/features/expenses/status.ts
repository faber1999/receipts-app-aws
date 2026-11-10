import type { Expense, ProcessedExpense } from '@receipts-app/contracts';

/** A receipt the AI has read: it carries merchant, total, currency and category, so it counts and can be edited. */
export function isProcessed(expense: Expense): expense is ProcessedExpense {
  return expense.status === 'PROCESSED';
}

/** Uploaded receipts keep their photo (whatever their status); expenses entered by hand have none. */
export function hasReceiptPhoto(expense: Expense): boolean {
  return expense.imageKey !== undefined;
}
