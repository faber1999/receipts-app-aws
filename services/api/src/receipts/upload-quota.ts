import { MAX_RECEIPT_UPLOADS_PER_DAY } from '@receipts-app/contracts';
import { userPk } from '../expenses/expense-repository';

/** The counter outlives its day, then the table's TTL removes it. */
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * UpdateItem parts that take one upload from the user's daily quota (UTC day).
 * ADD is atomic, so two uploads at once can't both take the last slot; the condition fails once the quota is used.
 */
export function toUploadQuotaUpdate(userId: string, now: Date) {
  const day = now.toISOString().slice(0, 10);
  return {
    Key: { PK: userPk(userId), SK: `UPLOADS#${day}` },
    UpdateExpression: 'ADD #count :one SET #expiresAt = if_not_exists(#expiresAt, :expiresAt)',
    ConditionExpression: 'attribute_not_exists(#count) OR #count < :max',
    // COUNT is a DynamoDB reserved word.
    ExpressionAttributeNames: { '#count': 'count', '#expiresAt': 'expiresAt' },
    ExpressionAttributeValues: {
      ':one': 1,
      ':max': MAX_RECEIPT_UPLOADS_PER_DAY,
      ':expiresAt': Math.floor(now.getTime() / 1000) + COUNTER_TTL_SECONDS,
    },
  };
}
