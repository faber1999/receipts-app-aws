import type { Expense, ProcessedExpense, ReviewExpense, UnprocessedExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { hasPendingReceipt, POLL_WINDOW_MS, settleReceipts, shouldKeepPolling } from './polling';

function receipt(id: string, status: UnprocessedExpense['status']): UnprocessedExpense {
  return { id, status, date: '2026-11-08', createdAt: '2026-11-08T15:00:00.000Z', imageKey: `receipts/${id}.jpg` };
}

function processed(id: string, date = '2026-11-08'): ProcessedExpense {
  return {
    id,
    status: 'PROCESSED',
    merchant: 'Café Aroma',
    total: 12000,
    currency: 'COP',
    date,
    category: 'restaurants',
    createdAt: '2026-11-08T15:00:00.000Z',
  };
}

function toReview(id: string): ReviewExpense {
  return {
    id,
    status: 'REVIEW',
    merchant: 'Café Aroma',
    date: '2026-11-08',
    createdAt: '2026-11-08T15:00:00.000Z',
    imageKey: `receipts/${id}.jpg`,
  };
}

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

describe('hasPendingReceipt', () => {
  it('is true only when a receipt is still being read', () => {
    expect(hasPendingReceipt([processed(A), receipt(B, 'PENDING')])).toBe(true);
    expect(hasPendingReceipt([processed(A), receipt(B, 'FAILED')])).toBe(false);
    expect(hasPendingReceipt([toReview(A)])).toBe(false);
    expect(hasPendingReceipt([])).toBe(false);
    expect(hasPendingReceipt(null)).toBe(false);
  });
});

describe('shouldKeepPolling', () => {
  const pending: Expense[] = [receipt(A, 'PENDING')];

  it('keeps polling inside the window while something is pending', () => {
    expect(shouldKeepPolling(pending, 1000, 1000 + POLL_WINDOW_MS - 1)).toBe(true);
  });

  it('stops when the window runs out', () => {
    expect(shouldKeepPolling(pending, 1000, 1000 + POLL_WINDOW_MS)).toBe(false);
  });

  it('stops as soon as nothing is pending', () => {
    expect(shouldKeepPolling([processed(A)], 1000, 1001)).toBe(false);
  });
});

describe('settleReceipts', () => {
  it('reports pending receipts that were read in place, to review or failed', () => {
    const before = [receipt(A, 'PENDING'), receipt(B, 'PENDING')];
    const after = [toReview(A), receipt(B, 'FAILED')];
    expect(settleReceipts(before, after)).toEqual({ read: [A, B], toReview: [A], failed: [B], moved: [] });
  });

  it('counts a receipt confirmed elsewhere as read, but not as one to review', () => {
    const before = [receipt(A, 'PENDING')];
    const after = [processed(A)];
    expect(settleReceipts(before, after)).toEqual({ read: [A], toReview: [], failed: [], moved: [] });
  });

  it('reports a pending receipt that left the month', () => {
    const before = [receipt(A, 'PENDING'), processed(C)];
    const after = [processed(C)];
    expect(settleReceipts(before, after)).toEqual({ read: [], toReview: [], failed: [], moved: [A] });
  });

  it('ignores receipts still pending and rows that were never pending', () => {
    const before = [receipt(A, 'PENDING'), processed(C), receipt(B, 'FAILED')];
    const after = [receipt(A, 'PENDING')];
    expect(settleReceipts(before, after)).toEqual({ read: [], toReview: [], failed: [], moved: [] });
  });
});
