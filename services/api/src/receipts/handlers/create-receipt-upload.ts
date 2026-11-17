import { randomUUID } from 'node:crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  type CreateReceiptUploadResponse,
  createReceiptUploadInputSchema,
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_UPLOADS_PER_DAY,
  type UnprocessedExpense,
} from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { toItem } from '../../expenses/expense-repository';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { json, parseJsonBody } from '../../shared/http';
import { buildReceiptKey } from '../receipt-key';
import { toUploadQuotaUpdate } from '../upload-quota';

const logger = new Logger({ serviceName: 'expenses-api' });
const s3 = new S3Client({});

const UPLOAD_EXPIRES_SECONDS = 300;
/** A PENDING expense whose photo never arrives is deleted by the table's TTL after a day. */
const PENDING_TTL_SECONDS = 24 * 60 * 60;

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);

  const parsed = createReceiptUploadInputSchema.safeParse(parseJsonBody(event.body, event.isBase64Encoded));
  if (!parsed.success) {
    return json(400, { message: 'Invalid receipt upload', errors: z.flattenError(parsed.error).fieldErrors });
  }

  const { contentType } = parsed.data;
  const id = randomUUID();
  const now = new Date();

  // Each upload costs an AI extraction, so the daily quota is taken before anything is created.
  try {
    await db.send(new UpdateCommand({ TableName: env.TABLE_NAME, ...toUploadQuotaUpdate(userId, now) }));
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      logger.info('Daily upload limit reached');
      return json(429, { message: `You can upload up to ${MAX_RECEIPT_UPLOADS_PER_DAY} receipts a day` });
    }
    throw error;
  }

  const imageKey = buildReceiptKey({ userId, receiptId: id, contentType });

  const expense: UnprocessedExpense = {
    id,
    status: 'PENDING',
    date: now.toISOString().slice(0, 10),
    imageKey,
    createdAt: now.toISOString(),
  };

  await db.send(
    new PutCommand({
      TableName: env.TABLE_NAME,
      Item: { ...toItem(userId, expense), expiresAt: Math.floor(now.getTime() / 1000) + PENDING_TTL_SECONDS },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );

  // The POST policy is enforced by S3 itself: wrong type, an empty file or one over the limit is rejected.
  const upload = await createPresignedPost(s3, {
    Bucket: env.RECEIPTS_BUCKET,
    Key: imageKey,
    Fields: { 'Content-Type': contentType },
    Conditions: [
      ['content-length-range', 1, MAX_RECEIPT_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Expires: UPLOAD_EXPIRES_SECONDS,
  });

  logger.info('Created receipt upload', { expenseId: id });

  const body: CreateReceiptUploadResponse = { expense, upload: { url: upload.url, fields: upload.fields } };
  return json(201, body);
}
