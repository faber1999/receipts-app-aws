import { Logger } from '@aws-lambda-powertools/logger';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ReceiptPhotoResponse } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { expenseKey } from '../../expenses/expense-repository';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { getPathId, json, notFound } from '../../shared/http';

const logger = new Logger({ serviceName: 'expenses-api' });
const s3 = new S3Client({});

const PHOTO_URL_EXPIRES_SECONDS = 300;

/** Manual expenses have no photo, so imageKey is required here. */
const itemSchema = z.object({ imageKey: z.string() });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  const expenseId = getPathId(event.pathParameters);
  if (!expenseId) {
    return notFound();
  }

  // Looked up with the caller's own key: another user's expense is simply not found.
  const { Item } = await db.send(
    new GetCommand({
      TableName: env.TABLE_NAME,
      Key: expenseKey(userId, expenseId),
      ProjectionExpression: 'imageKey',
    }),
  );
  if (!Item) {
    return notFound();
  }

  const item = itemSchema.safeParse(Item);
  if (!item.success) {
    return json(404, { message: 'This expense has no receipt photo' });
  }

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.RECEIPTS_BUCKET, Key: item.data.imageKey }), {
    expiresIn: PHOTO_URL_EXPIRES_SECONDS,
  });

  logger.info('Signed receipt photo URL', { expenseId });
  const body: ReceiptPhotoResponse = {
    url,
    expiresAt: new Date(Date.now() + PHOTO_URL_EXPIRES_SECONDS * 1000).toISOString(),
  };
  return json(200, body);
}
