import type { Expense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { isProcessed } from './status';

const base = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  date: '2026-11-03',
  createdAt: '2026-11-03T15:00:00.000Z',
};

describe('isProcessed', () => {
  it('accepts a receipt the AI has read', () => {
    const expense: Expense = {
      ...base,
      status: 'PROCESSED',
      merchant: 'Café Aroma',
      total: 12000,
      currency: 'COP',
      category: 'restaurants',
    };
    expect(isProcessed(expense)).toBe(true);
  });

  it('rejects receipts that are pending or failed', () => {
    const pending: Expense = { ...base, status: 'PENDING', imageKey: 'receipts/a.jpg' };
    const failed: Expense = { ...base, status: 'FAILED', imageKey: 'receipts/b.jpg' };
    expect(isProcessed(pending)).toBe(false);
    expect(isProcessed(failed)).toBe(false);
  });
});
