import type { ExtractedExpense } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { toExtractionUpdate } from './extraction-update';

const FULL: ExtractedExpense = {
  merchant: 'Carulla Armenia Plaza',
  total: 716151,
  currency: 'COP',
  date: '2026-11-07',
  category: 'groceries',
};

describe('toExtractionUpdate', () => {
  it('saves every field read, moves the item to its receipt date and asks for review', () => {
    const update = toExtractionUpdate(FULL);

    expect(update.ExpressionAttributeValues).toEqual({
      ':merchant': 'Carulla Armenia Plaza',
      ':total': 716151,
      ':currency': 'COP',
      ':date': '2026-11-07',
      ':category': 'groceries',
      ':GSI1SK': 'DATE#2026-11-07',
      ':status': 'REVIEW',
      ':pending': 'PENDING',
    });
    expect(update.ConditionExpression).toBe('#status = :pending');
  });

  it('leaves out what the AI could not read, keeping the upload date in place', () => {
    const update = toExtractionUpdate({ ...FULL, date: null, total: null });

    expect(update.UpdateExpression).not.toContain('#date');
    expect(update.UpdateExpression).not.toContain('#total');
    expect(update.UpdateExpression).not.toContain('#GSI1SK');
    expect(update.UpdateExpression).toContain('#merchant = :merchant');
  });

  it('still asks for review when nothing could be read', () => {
    const update = toExtractionUpdate({ merchant: null, total: null, currency: null, date: null, category: null });

    expect(update.UpdateExpression).toBe('SET #status = :status');
  });
});
