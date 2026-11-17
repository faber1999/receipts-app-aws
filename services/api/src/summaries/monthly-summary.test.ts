import type { Expense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { buildMonthlySummary, isEmptySummary, previousMonth, renderSummaryEmail } from './monthly-summary';

const base = { date: '2026-10-15', createdAt: '2026-10-15T12:00:00.000Z', imageKey: 'receipts/u/r.jpg' };
let nextId = 0;
const id = (): string => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`;

function processed(total: number, currency: string, category: 'groceries' | 'restaurants' | 'transport'): Expense {
  return { ...base, id: id(), status: 'PROCESSED', merchant: 'Shop', total, currency, category };
}

const review: Expense = { ...base, id: id(), status: 'REVIEW', total: 5000 };
const failed: Expense = { ...base, id: id(), status: 'FAILED' };
const pending: Expense = { ...base, id: id(), status: 'PENDING' };

describe('previousMonth', () => {
  it('returns the month that just ended', () => {
    expect(previousMonth(new Date('2026-11-01T13:00:00Z'))).toBe('2026-10');
  });

  it('crosses the year boundary in January', () => {
    expect(previousMonth(new Date('2027-01-01T13:00:00Z'))).toBe('2026-12');
  });
});

describe('buildMonthlySummary', () => {
  it('adds up confirmed expenses per currency and category, largest category first', () => {
    const summary = buildMonthlySummary('2026-10', [
      processed(70500, 'COP', 'restaurants'),
      processed(120000, 'COP', 'groceries'),
      processed(30000, 'COP', 'restaurants'),
      processed(12.5, 'USD', 'transport'),
    ]);

    expect(summary.totals).toEqual([
      {
        currency: 'COP',
        total: 220500,
        byCategory: [
          { category: 'groceries', total: 120000 },
          { category: 'restaurants', total: 100500 },
        ],
      },
      { currency: 'USD', total: 12.5, byCategory: [{ category: 'transport', total: 12.5 }] },
    ]);
    expect(summary.expenseCount).toBe(4);
  });

  it('counts receipts waiting for review apart and ignores the ones still being read', () => {
    const summary = buildMonthlySummary('2026-10', [processed(10, 'USD', 'transport'), review, failed, pending]);

    expect(summary.totals).toHaveLength(1);
    expect(summary.expenseCount).toBe(1);
    expect(summary.needsAttention).toBe(2);
  });

  it('rounds away floating-point noise', () => {
    const summary = buildMonthlySummary('2026-10', [
      processed(0.1, 'USD', 'transport'),
      processed(0.2, 'USD', 'transport'),
    ]);

    expect(summary.totals[0]?.total).toBe(0.3);
  });
});

describe('isEmptySummary', () => {
  it('is empty only when there is nothing confirmed and nothing waiting', () => {
    expect(isEmptySummary(buildMonthlySummary('2026-10', [pending]))).toBe(true);
    expect(isEmptySummary(buildMonthlySummary('2026-10', [failed]))).toBe(false);
  });
});

describe('renderSummaryEmail', () => {
  it('names the month and lists each category with its total', () => {
    const email = renderSummaryEmail(buildMonthlySummary('2026-10', [processed(70500, 'COP', 'restaurants')]));

    expect(email.subject).toBe('Receipts App: your October 2026 summary');
    expect(email.text).toContain('Restaurants:');
    expect(email.text).toContain('70,500');
    expect(email.text).not.toContain('waiting for your review');
  });

  it('reminds the person of receipts still waiting for review', () => {
    const email = renderSummaryEmail(buildMonthlySummary('2026-10', [review, failed]));

    expect(email.text).toContain('No confirmed expenses this month.');
    expect(email.text).toContain('2 receipts are waiting for your review');
  });
});
