import { MAX_RECEIPT_UPLOADS_PER_DAY } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { toUploadQuotaUpdate } from './upload-quota';

const now = new Date('2026-11-17T23:30:00Z');

describe('toUploadQuotaUpdate', () => {
  it('counts uploads per user and UTC day', () => {
    expect(toUploadQuotaUpdate('user-1', now).Key).toEqual({ PK: 'USER#user-1', SK: 'UPLOADS#2026-11-17' });
  });

  it('adds one atomically and refuses once the daily quota is used', () => {
    const update = toUploadQuotaUpdate('user-1', now);

    expect(update.UpdateExpression).toContain('ADD #count :one');
    expect(update.ConditionExpression).toBe('attribute_not_exists(#count) OR #count < :max');
    expect(update.ExpressionAttributeValues[':max']).toBe(MAX_RECEIPT_UPLOADS_PER_DAY);
  });

  it('keeps the first expiry, so the counter is removed two days after its first upload', () => {
    const update = toUploadQuotaUpdate('user-1', now);

    expect(update.UpdateExpression).toContain('#expiresAt = if_not_exists(#expiresAt, :expiresAt)');
    expect(update.ExpressionAttributeValues[':expiresAt']).toBe(now.getTime() / 1000 + 2 * 24 * 60 * 60);
  });
});
