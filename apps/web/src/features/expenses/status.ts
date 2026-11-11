import type { Expense, ProcessedExpense, ReviewExpense, UnprocessedExpense } from '@receipts-app/contracts';

/** A receipt the AI could not read (or that failed): only its photo, no expense data. */
export type FailedExpense = UnprocessedExpense & { status: 'FAILED' };

/** A receipt the person can finish from its photo: one the AI read (REVIEW) or one it could not (FAILED). */
export type CompletableExpense = ReviewExpense | FailedExpense;

/** Confirmed by the person (or entered by hand): it has every field, so it counts and can be edited. */
export function isProcessed(expense: Expense): expense is ProcessedExpense {
  return expense.status === 'PROCESSED';
}

/** Read by the AI and waiting for the person to confirm it. */
export function isAwaitingReview(expense: Expense): expense is ReviewExpense {
  return expense.status === 'REVIEW';
}

/** REVIEW or FAILED: confirmed with POST /expenses/{id}/confirm, never edited with PATCH. */
export function isCompletable(expense: Expense): expense is CompletableExpense {
  return expense.status === 'REVIEW' || expense.status === 'FAILED';
}

/** Uploaded receipts keep their photo (whatever their status); expenses entered by hand have none. */
export function hasReceiptPhoto(expense: Expense): boolean {
  return expense.imageKey !== undefined;
}

/** The day the receipt was uploaded (YYYY-MM-DD, as the API dates it). */
export function uploadDay(expense: Expense): string {
  return expense.createdAt.slice(0, 10);
}
