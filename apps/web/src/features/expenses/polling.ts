import type { Expense } from '@receipts-app/contracts';

/** How often a month with receipts still being read is refetched. */
export const POLL_INTERVAL_MS = 3000;

/** Polling gives up after this long; a receipt still PENDING by then waits for the next visit. */
export const POLL_WINDOW_MS = 2 * 60 * 1000;

export function hasPendingReceipt(items: readonly Expense[] | null | undefined): boolean {
  return items?.some((expense) => expense.status === 'PENDING') ?? false;
}

/** Keep polling while something is still being read and the window has not run out. */
export function shouldKeepPolling(items: readonly Expense[], startedAt: number, now: number): boolean {
  return hasPendingReceipt(items) && now - startedAt < POLL_WINDOW_MS;
}

export interface ReceiptSettlement {
  /** Were PENDING, now PROCESSED or FAILED in the same month. */
  read: string[];
  /** Were PENDING and are gone: the AI dated them in another month (or they were deleted elsewhere). */
  moved: string[];
}

/** Compares one month before and after a refresh to see which of its pending receipts settled, and how. */
export function settleReceipts(before: readonly Expense[], after: readonly Expense[]): ReceiptSettlement {
  const now = new Map(after.map((expense) => [expense.id, expense]));
  const read: string[] = [];
  const moved: string[] = [];

  for (const expense of before) {
    if (expense.status !== 'PENDING') continue;
    const current = now.get(expense.id);
    if (!current) moved.push(expense.id);
    else if (current.status !== 'PENDING') read.push(expense.id);
  }
  return { read, moved };
}
