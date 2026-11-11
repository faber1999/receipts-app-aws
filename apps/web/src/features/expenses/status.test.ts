import type { Expense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { hasReceiptPhoto, isAwaitingReview, isCompletable, isProcessed, uploadDay } from './status';

const base = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  date: '2026-11-03',
  createdAt: '2026-11-03T15:00:00.000Z',
};

const processed: Expense = {
  ...base,
  status: 'PROCESSED',
  merchant: 'Café Aroma',
  total: 12000,
  currency: 'COP',
  category: 'restaurants',
};
const pending: Expense = { ...base, status: 'PENDING', imageKey: 'receipts/a.jpg' };
const review: Expense = { ...base, status: 'REVIEW', imageKey: 'receipts/b.jpg', merchant: 'Café Aroma' };
const failed: Expense = { ...base, status: 'FAILED', imageKey: 'receipts/c.jpg' };

describe('isProcessed', () => {
  it('accepts only a confirmed expense', () => {
    expect(isProcessed(processed)).toBe(true);
    expect(isProcessed(pending)).toBe(false);
    expect(isProcessed(review)).toBe(false);
    expect(isProcessed(failed)).toBe(false);
  });
});

describe('isAwaitingReview', () => {
  it('accepts only a receipt the AI has read', () => {
    expect(isAwaitingReview(review)).toBe(true);
    expect([processed, pending, failed].some(isAwaitingReview)).toBe(false);
  });
});

describe('isCompletable', () => {
  it('accepts receipts to review and receipts that failed, which are confirmed rather than edited', () => {
    expect(isCompletable(review)).toBe(true);
    expect(isCompletable(failed)).toBe(true);
  });

  it('rejects a receipt still being read and a confirmed expense', () => {
    expect(isCompletable(pending)).toBe(false);
    expect(isCompletable(processed)).toBe(false);
  });
});

describe('hasReceiptPhoto', () => {
  it('is true for uploaded receipts in any status', () => {
    const read: Expense = { ...processed, imageKey: 'receipts/d.jpg' };
    expect([pending, review, failed, read].every(hasReceiptPhoto)).toBe(true);
  });

  it('is false for an expense entered by hand', () => {
    expect(hasReceiptPhoto(processed)).toBe(false);
  });
});

describe('uploadDay', () => {
  it('is the calendar day of createdAt, whatever the expense date is', () => {
    expect(uploadDay({ ...review, date: '2026-10-28' })).toBe('2026-11-03');
  });
});
