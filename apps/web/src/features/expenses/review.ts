import type { Expense, ExpenseCategory, ReviewExpense } from '@receipts-app/contracts';
import { type CompletableExpense, isAwaitingReview, uploadDay } from './status';

/** The fields the AI may leave out of a REVIEW expense (the date is always there). */
export const READABLE_FIELDS = ['merchant', 'total', 'currency', 'category'] as const;
export type ReadableField = (typeof READABLE_FIELDS)[number];

/** Fields the person has to fill in: the ones the AI could not read, or all of them for a FAILED receipt. */
export function unreadFields(expense: CompletableExpense): ReadableField[] {
  if (expense.status === 'FAILED') return [...READABLE_FIELDS];
  return READABLE_FIELDS.filter((field) => expense[field] === undefined);
}

/**
 * The date is always present, but when it equals the upload day the AI most likely did not
 * read it (the API falls back to the upload date), so the person should check it.
 */
export function dateNeedsCheck(expense: CompletableExpense): boolean {
  return expense.date === uploadDay(expense);
}

/** What the review form starts from: whatever was read; '' or null where nothing was. */
export interface ReviewDraft {
  merchant: string;
  total: number | null;
  currency: string;
  date: string;
  category: ExpenseCategory | '';
}

export function reviewDraft(expense: CompletableExpense): ReviewDraft {
  if (expense.status === 'FAILED') {
    return { merchant: '', total: null, currency: '', date: expense.date, category: '' };
  }
  return {
    merchant: expense.merchant ?? '',
    total: expense.total ?? null,
    currency: expense.currency ?? '',
    date: expense.date,
    category: expense.category ?? '',
  };
}

/** The first receipt waiting for review, in list order (newest first). */
export function firstToReview(items: readonly Expense[]): ReviewExpense | undefined {
  return items.find(isAwaitingReview);
}
