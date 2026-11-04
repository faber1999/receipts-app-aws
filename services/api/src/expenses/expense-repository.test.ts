import type { ProcessedExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { expenseKey, fromItem, toItem, toUpdateExpression } from './expense-repository';

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

describe('toItem', () => {
  it('adds the single-table keys', () => {
    expect(toItem('user-1', expense)).toMatchObject({
      PK: 'USER#user-1',
      SK: `RECEIPT#${expense.id}`,
      GSI1PK: 'USER#user-1',
      GSI1SK: 'DATE#2026-11-03',
    });
  });
});

describe('fromItem', () => {
  it('returns the contract shape without the key attributes', () => {
    expect(fromItem(toItem('user-1', expense))).toEqual(expense);
  });

  it('rejects items that do not match the contract', () => {
    expect(() => fromItem({ id: 'not-a-uuid', status: 'PROCESSED' })).toThrow();
  });
});

describe('expenseKey', () => {
  it('builds the primary key of an expense', () => {
    expect(expenseKey('user-1', 'abc')).toEqual({ PK: 'USER#user-1', SK: 'RECEIPT#abc' });
  });
});

describe('toUpdateExpression', () => {
  it('aliases every attribute name, because date and status are reserved words', () => {
    expect(toUpdateExpression({ total: 90000 })).toEqual({
      UpdateExpression: 'SET #total = :total',
      ExpressionAttributeNames: { '#total': 'total' },
      ExpressionAttributeValues: { ':total': 90000 },
    });
  });

  it('moves the item in GSI1 when the date changes', () => {
    const result = toUpdateExpression({ date: '2026-12-01' });

    expect(result.UpdateExpression).toBe('SET #date = :date, #GSI1SK = :GSI1SK');
    expect(result.ExpressionAttributeValues).toEqual({
      ':date': '2026-12-01',
      ':GSI1SK': 'DATE#2026-12-01',
    });
  });

  it('only sets the fields that were provided', () => {
    const result = toUpdateExpression({ merchant: 'Nuevo', category: 'health' });

    expect(result.UpdateExpression).toBe('SET #merchant = :merchant, #category = :category');
    expect(result.ExpressionAttributeValues).not.toHaveProperty(':GSI1SK');
  });
});
