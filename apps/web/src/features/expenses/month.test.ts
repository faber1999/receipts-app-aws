import type { Expense, ProcessedExpense, UnprocessedExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyExpenseChange,
  currentMonthKey,
  monthKeyOf,
  shiftMonth,
  sortExpenses,
  summarizeMonth,
  todayIsoDate,
} from './month';

let seq = 0;

function processed(overrides: Partial<ProcessedExpense> = {}): ProcessedExpense {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    status: 'PROCESSED',
    merchant: 'Café Aroma',
    total: 10000,
    currency: 'COP',
    date: '2026-11-03',
    category: 'restaurants',
    createdAt: '2026-11-03T15:00:00.000Z',
    ...overrides,
  };
}

function unprocessed(
  status: UnprocessedExpense['status'],
  overrides: Partial<UnprocessedExpense> = {},
): UnprocessedExpense {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    status,
    imageKey: `receipts/${seq}.jpg`,
    date: '2026-11-03',
    createdAt: '2026-11-03T15:00:00.000Z',
    ...overrides,
  };
}

describe('month keys', () => {
  it('uses the local calendar date, not UTC', () => {
    // Built from local fields, so it is the same date in any time zone the test runs in.
    const now = new Date(2026, 0, 5, 23, 59);
    expect(todayIsoDate(now)).toBe('2026-01-05');
    expect(currentMonthKey(now)).toBe('2026-01');
  });

  it('reads the month of an ISO date', () => {
    expect(monthKeyOf('2026-11-03')).toBe('2026-11');
  });

  it('steps to the previous and next month across year boundaries', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
    expect(shiftMonth('2026-03', 0)).toBe('2026-03');
  });
});

describe('sortExpenses', () => {
  it('lists newest first and breaks same-day ties by creation time', () => {
    const older = processed({ date: '2026-11-01' });
    const sameDayEarly = processed({ date: '2026-11-03', createdAt: '2026-11-03T08:00:00.000Z' });
    const sameDayLate = processed({ date: '2026-11-03', createdAt: '2026-11-03T20:00:00.000Z' });
    const input = [older, sameDayEarly, sameDayLate];
    expect(sortExpenses(input)).toEqual([sameDayLate, sameDayEarly, older]);
    expect(input).toEqual([older, sameDayEarly, sameDayLate]);
  });
});

describe('applyExpenseChange', () => {
  it('adds a created expense to its month in sorted position', () => {
    const existing = processed({ date: '2026-11-02' });
    const created = processed({ date: '2026-11-05' });
    expect(applyExpenseChange([existing], '2026-11', { type: 'upsert', expense: created })).toEqual([
      created,
      existing,
    ]);
  });

  it('replaces an updated expense instead of duplicating it', () => {
    const expense = processed({ total: 10000 });
    const updated = { ...expense, total: 25000 };
    expect(applyExpenseChange([expense], '2026-11', { type: 'upsert', expense: updated })).toEqual([updated]);
  });

  it('removes an expense whose new date moved it to another month', () => {
    const expense = processed({ date: '2026-11-03' });
    const moved = { ...expense, date: '2026-10-28' };
    const change = { type: 'upsert', expense: moved } as const;
    expect(applyExpenseChange([expense], '2026-11', change)).toEqual([]);
    expect(applyExpenseChange([], '2026-10', change)).toEqual([moved]);
  });

  it('drops a deleted expense and ignores ids it does not hold', () => {
    const keep = processed();
    const drop = processed();
    expect(applyExpenseChange([keep, drop], '2026-11', { type: 'remove', id: drop.id })).toEqual([keep]);
    expect(applyExpenseChange([keep], '2026-11', { type: 'remove', id: drop.id })).toEqual([keep]);
  });
});

describe('summarizeMonth', () => {
  it('totals each currency separately and never adds amounts across currencies', () => {
    const summary = summarizeMonth([
      processed({ total: 10000, currency: 'COP' }),
      processed({ total: 5000, currency: 'COP' }),
      processed({ total: 12.5, currency: 'USD' }),
    ]);
    expect(summary.currencies.map(({ currency, total, count }) => ({ currency, total, count }))).toEqual([
      { currency: 'COP', total: 15000, count: 2 },
      { currency: 'USD', total: 12.5, count: 1 },
    ]);
  });

  it('orders currencies by count, then by code', () => {
    const summary = summarizeMonth([
      processed({ currency: 'USD' }),
      processed({ currency: 'EUR' }),
      processed({ currency: 'COP' }),
      processed({ currency: 'COP' }),
    ]);
    expect(summary.currencies.map((group) => group.currency)).toEqual(['COP', 'EUR', 'USD']);
  });

  it('breaks each currency into categories, largest first, with their share', () => {
    const [cop] = summarizeMonth([
      processed({ total: 30000, category: 'groceries' }),
      processed({ total: 10000, category: 'transport' }),
      processed({ total: 60000, category: 'groceries' }),
    ]).currencies;
    expect(cop?.categories).toEqual([
      { category: 'groceries', total: 90000, share: 0.9 },
      { category: 'transport', total: 10000, share: 0.1 },
    ]);
  });

  it('reports a zero share when the currency total is zero', () => {
    const [cop] = summarizeMonth([processed({ total: 0 })]).currencies;
    expect(cop?.categories).toEqual([{ category: 'restaurants', total: 0, share: 0 }]);
  });

  it('counts pending and failed receipts and leaves them out of the totals', () => {
    const expenses: Expense[] = [
      processed({ total: 10000 }),
      unprocessed('PENDING'),
      unprocessed('PENDING'),
      unprocessed('FAILED'),
    ];
    const summary = summarizeMonth(expenses);
    expect(summary.pendingCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.currencies).toHaveLength(1);
    expect(summary.currencies[0]).toMatchObject({ total: 10000, count: 1 });
  });

  it('is empty for a month without expenses', () => {
    expect(summarizeMonth([])).toEqual({ currencies: [], pendingCount: 0, failedCount: 0 });
  });
});
