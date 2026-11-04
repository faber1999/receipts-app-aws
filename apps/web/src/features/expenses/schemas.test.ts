import type { ProcessedExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { changedFields, parseExpenseForm } from './schemas';

const expense: ProcessedExpense = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  status: 'PROCESSED',
  merchant: 'Café Aroma',
  total: 12000,
  currency: 'COP',
  date: '2026-11-03',
  category: 'restaurants',
  createdAt: '2026-11-03T15:00:00.000Z',
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const validFields = {
  merchant: 'Café Aroma',
  total: '12000',
  currency: 'COP',
  date: '2026-11-03',
  category: 'restaurants',
};

describe('changedFields', () => {
  it('sends nothing when the form matches the expense', () => {
    expect(changedFields(expense, { ...expense })).toEqual({});
  });

  it('sends only the fields the user changed', () => {
    expect(changedFields(expense, { ...expense, total: 15000, category: 'groceries' })).toEqual({
      total: 15000,
      category: 'groceries',
    });
  });
});

describe('parseExpenseForm', () => {
  it('returns the typed input for a valid form', () => {
    expect(parseExpenseForm(form(validFields))).toEqual({
      success: true,
      data: { ...validFields, total: 12000 },
    });
  });

  it('rejects an empty amount instead of coercing it to zero', () => {
    expect(parseExpenseForm(form({ ...validFields, total: '  ' }))).toEqual({
      success: false,
      errors: { total: 'totalInvalid' },
    });
  });

  it('accepts a zero amount the user typed', () => {
    const parsed = parseExpenseForm(form({ ...validFields, total: '0' }));
    expect(parsed.success && parsed.data.total).toBe(0);
  });

  it('maps every failing field to its dictionary key', () => {
    expect(
      parseExpenseForm(form({ merchant: '', total: 'abc', currency: 'pesos', date: '03/11/2026', category: 'misc' })),
    ).toEqual({
      success: false,
      errors: {
        merchant: 'merchantRequired',
        total: 'totalInvalid',
        currency: 'currencyInvalid',
        date: 'dateInvalid',
        category: 'categoryInvalid',
      },
    });
  });

  it('tells a too-long merchant apart from a missing one', () => {
    expect(parseExpenseForm(form({ ...validFields, merchant: 'x'.repeat(121) }))).toEqual({
      success: false,
      errors: { merchant: 'merchantTooLong' },
    });
  });

  it('treats missing fields as empty', () => {
    const parsed = parseExpenseForm(new FormData());
    expect(parsed.success).toBe(false);
    expect(parsed.success ? {} : parsed.errors).toMatchObject({ merchant: 'merchantRequired', total: 'totalInvalid' });
  });
});
