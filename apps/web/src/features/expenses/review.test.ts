import type { Expense, ReviewExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { dateNeedsCheck, firstToReview, READABLE_FIELDS, reviewDraft, unreadFields } from './review';
import type { FailedExpense } from './status';

const base = {
  imageKey: 'receipts/a.jpg',
  date: '2026-11-03',
  createdAt: '2026-11-03T15:00:00.000Z',
};

function review(id: string, overrides: Partial<ReviewExpense> = {}): ReviewExpense {
  return { id, status: 'REVIEW', ...base, ...overrides };
}

const failed: FailedExpense = { id: '00000000-0000-4000-8000-00000000000f', status: 'FAILED', ...base };

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

describe('unreadFields', () => {
  it('lists only the fields the AI left out', () => {
    expect(unreadFields(review(A, { merchant: 'Tienda D1', total: 23450 }))).toEqual(['currency', 'category']);
  });

  it('is empty when everything was read', () => {
    const full = review(A, { merchant: 'Tienda D1', total: 23450, currency: 'COP', category: 'groceries' });
    expect(unreadFields(full)).toEqual([]);
  });

  it('keeps a total of 0 as read', () => {
    expect(unreadFields(review(A, { total: 0 }))).not.toContain('total');
  });

  it('lists every field for a receipt that failed', () => {
    expect(unreadFields(failed)).toEqual([...READABLE_FIELDS]);
  });
});

describe('dateNeedsCheck', () => {
  it('flags a date equal to the upload day: the AI most likely fell back to it', () => {
    expect(dateNeedsCheck(review(A))).toBe(true);
    expect(dateNeedsCheck(failed)).toBe(true);
  });

  it('trusts a date read from the receipt', () => {
    expect(dateNeedsCheck(review(A, { date: '2026-10-28' }))).toBe(false);
  });

  it('compares against the UTC day of createdAt, as the API stores it', () => {
    expect(dateNeedsCheck(review(A, { date: '2026-11-04', createdAt: '2026-11-04T02:30:00.000Z' }))).toBe(true);
  });
});

describe('reviewDraft', () => {
  it('prefills what was read and leaves the rest empty', () => {
    expect(reviewDraft(review(A, { merchant: 'Tienda D1', category: 'groceries' }))).toEqual({
      merchant: 'Tienda D1',
      total: null,
      currency: '',
      date: '2026-11-03',
      category: 'groceries',
    });
  });

  it('starts a failed receipt empty, except for its date', () => {
    expect(reviewDraft(failed)).toEqual({ merchant: '', total: null, currency: '', date: '2026-11-03', category: '' });
  });
});

describe('firstToReview', () => {
  it('returns the first receipt waiting for review, in list order', () => {
    const items: Expense[] = [{ ...failed }, review(A), review(B)];
    expect(firstToReview(items)?.id).toBe(A);
  });

  it('is undefined when nothing is waiting', () => {
    expect(firstToReview([failed])).toBeUndefined();
  });
});
