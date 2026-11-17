import type { ExtractedExpense, UpdateExpenseInput } from '@receipts-app/contracts';
import { toUpdateExpression } from '../expenses/expense-repository';

/** Keeps only the fields the AI read; the null ones stay empty for the person to fill in. */
export function readFields({ merchant, total, currency, date, category }: ExtractedExpense): UpdateExpenseInput {
  return {
    ...(merchant !== null && { merchant }),
    ...(total !== null && { total }),
    ...(currency !== null && { currency }),
    ...(date !== null && { date }),
    ...(category !== null && { category }),
  };
}

/**
 * UpdateItem parts for a receipt the AI has read: what it read, plus status REVIEW so the person confirms it.
 * Only a PENDING item is updated, so a duplicate event or an expense deleted meanwhile is a no-op.
 */
export function toExtractionUpdate(expense: ExtractedExpense) {
  const update = toUpdateExpression({ ...readFields(expense), status: 'REVIEW' });
  return {
    ...update,
    // Leaving PENDING: the expense is no longer abandoned, so the TTL must not delete it.
    UpdateExpression: `${update.UpdateExpression} REMOVE #expiresAt`,
    ConditionExpression: '#status = :pending',
    ExpressionAttributeNames: { ...update.ExpressionAttributeNames, '#expiresAt': 'expiresAt' },
    ExpressionAttributeValues: { ...update.ExpressionAttributeValues, ':pending': 'PENDING' },
  };
}
