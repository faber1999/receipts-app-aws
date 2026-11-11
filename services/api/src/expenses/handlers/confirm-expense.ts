import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createExpenseInputSchema } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { conflict, getPathId, json, notFound, parseJsonBody } from '../../shared/http';
import { expenseKey, fromItem, toUpdateExpression } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });

/**
 * POST /expenses/{id}/confirm: the person confirms a receipt the AI read (REVIEW) or completes one it
 * couldn't read (FAILED). Every field is required, so a confirmed expense is always complete.
 */
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  const expenseId = getPathId(event.pathParameters);
  if (!expenseId) {
    return notFound();
  }

  const parsed = createExpenseInputSchema.safeParse(parseJsonBody(event.body, event.isBase64Encoded));
  if (!parsed.success) {
    return json(400, { message: 'Invalid expense', errors: z.flattenError(parsed.error).fieldErrors });
  }

  const update = toUpdateExpression({ ...parsed.data, status: 'PROCESSED' });
  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: env.TABLE_NAME,
        Key: expenseKey(userId, expenseId),
        ...update,
        ConditionExpression: '#status IN (:review, :failed)',
        ExpressionAttributeValues: { ...update.ExpressionAttributeValues, ':review': 'REVIEW', ':failed': 'FAILED' },
        ReturnValues: 'ALL_NEW',
        // On a failed condition DynamoDB returns the current item, so "not found" and "wrong status" can be told apart.
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }),
    );

    logger.info('Confirmed expense', { expenseId });
    return json(200, fromItem(result.Attributes ?? {}));
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      return error.Item ? conflict('This expense is not waiting for confirmation') : notFound();
    }
    throw error;
  }
}
