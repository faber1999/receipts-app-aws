import type { Expense, ProcessedExpense } from '@receipts-app/contracts';

/** A receipt the AI has read: it carries merchant, total, currency and category, so it counts and can be edited. */
export function isProcessed(expense: Expense): expense is ProcessedExpense {
  return expense.status === 'PROCESSED';
}
