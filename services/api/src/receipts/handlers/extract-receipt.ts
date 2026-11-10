import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@aws-lambda-powertools/logger';
import { getParameter } from '@aws-lambda-powertools/parameters/ssm';
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import type { CreateExpenseInput } from '@receipts-app/contracts';
import { z } from 'zod';
import { createClaudeExtractor } from '../receipt-extractor';
import { parseReceiptKey } from '../receipt-key';

const logger = new Logger({ serviceName: 'receipt-processing' });
const s3 = new S3Client({});

const env = z
  .object({
    /** Name of the SSM SecureString that holds the Anthropic API key. */
    ANTHROPIC_API_KEY_PARAMETER: z.string().min(1),
  })
  .parse(process.env);

/** Input from the Step Functions workflow: the uploaded object, taken from the S3 event. */
const inputSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
});

export interface ExtractReceiptResult {
  userId: string;
  receiptId: string;
  expense: CreateExpenseInput;
}

/** The object is not a receipt this app created. Step Functions ignores it. */
export class NotAReceiptError extends Error {
  override name = 'NotAReceiptError';
}

/** The photo was read, but it isn't a usable receipt. Step Functions marks it FAILED without retrying. */
export class UnreadableReceiptError extends Error {
  override name = 'UnreadableReceiptError';
}

/** The photo was deleted (with its expense) before it was read. Step Functions ignores it. */
export class ReceiptDeletedError extends Error {
  override name = 'ReceiptDeletedError';
}

export async function handler(event: unknown): Promise<ExtractReceiptResult> {
  const { bucket, key } = inputSchema.parse(event);

  const receipt = parseReceiptKey(key);
  if (!receipt) {
    throw new NotAReceiptError(`Not a receipt key: ${key}`);
  }
  logger.appendKeys({ receiptId: receipt.receiptId });

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })).catch((error: unknown) => {
    if (error instanceof NoSuchKey) {
      throw new ReceiptDeletedError(`The receipt photo no longer exists: ${key}`);
    }
    throw error;
  });
  if (!object.Body) {
    throw new Error('The receipt object has no body');
  }
  const data = await object.Body.transformToByteArray();

  // Cached for 5 minutes: a rotated key is picked up without a redeploy.
  const apiKey = await getParameter(env.ANTHROPIC_API_KEY_PARAMETER, { decrypt: true, maxAge: 300 });
  if (!apiKey) {
    throw new Error(`Parameter ${env.ANTHROPIC_API_KEY_PARAMETER} not found`);
  }

  const extract = createClaudeExtractor(new Anthropic({ apiKey }));
  const extraction = await extract({ data, contentType: receipt.contentType });

  if (!extraction.expense) {
    logger.warn('Unreadable receipt', { reason: extraction.unreadableReason });
    throw new UnreadableReceiptError(extraction.unreadableReason ?? 'Unreadable receipt');
  }

  logger.info('Extracted receipt', { category: extraction.expense.category, currency: extraction.expense.currency });
  return { userId: receipt.userId, receiptId: receipt.receiptId, expense: extraction.expense };
}
