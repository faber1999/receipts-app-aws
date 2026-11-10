import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { getPathId, notFound } from '../../shared/http';
import { expenseKey } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });
const s3 = new S3Client({});

/** The only attribute needed from the deleted item: where its photo lives, if it has one. */
const deletedItemSchema = z.object({ imageKey: z.string().optional() });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  const expenseId = getPathId(event.pathParameters);
  if (!expenseId) {
    return notFound();
  }

  let imageKey: string | undefined;
  try {
    const result = await db.send(
      new DeleteCommand({
        TableName: env.TABLE_NAME,
        Key: expenseKey(userId, expenseId),
        ConditionExpression: 'attribute_exists(PK)',
        // Returns the item as it was before the delete, so we know which photo to remove.
        ReturnValues: 'ALL_OLD',
      }),
    );
    imageKey = deletedItemSchema.parse(result.Attributes ?? {}).imageKey;
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      return notFound();
    }
    throw error;
  }

  if (imageKey) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: env.RECEIPTS_BUCKET, Key: imageKey }));
    } catch (error: unknown) {
      // The expense is already gone; an orphan photo is not worth failing the request for.
      logger.warn('Could not delete the receipt photo', { expenseId, error });
    }
  }

  logger.info('Deleted expense', { expenseId, hadPhoto: imageKey !== undefined });
  return { statusCode: 204 };
}
