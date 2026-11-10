import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { extractedExpenseSchema } from '@receipts-app/contracts';
import { z } from 'zod';
import { expenseKey } from '../../expenses/expense-repository';
import { db } from '../../shared/db';
import { toExtractionUpdate } from '../extraction-update';

const logger = new Logger({ serviceName: 'receipt-processing' });

const env = z.object({ TABLE_NAME: z.string().min(1) }).parse(process.env);

/** Input from the workflow: what extract-receipt returned. */
const inputSchema = z.object({
  userId: z.string().min(1),
  receiptId: z.uuid(),
  expense: extractedExpenseSchema,
});

export interface SaveExtractionResult {
  /** False when the receipt was no longer PENDING (a duplicate event, or the expense was deleted meanwhile). */
  saved: boolean;
}

export async function handler(event: unknown): Promise<SaveExtractionResult> {
  const { userId, receiptId, expense } = inputSchema.parse(event);
  logger.appendKeys({ receiptId });

  try {
    await db.send(
      new UpdateCommand({
        TableName: env.TABLE_NAME,
        Key: expenseKey(userId, receiptId),
        ...toExtractionUpdate(expense),
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      logger.info('The receipt is no longer pending; nothing to save');
      return { saved: false };
    }
    throw error;
  }

  const missing = Object.entries(expense)
    .filter(([, value]) => value === null)
    .map(([field]) => field);
  logger.info('Saved the extraction for review', { missing });
  return { saved: true };
}
