import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { updateExpenseInputSchema } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { getPathId, json, notFound, parseJsonBody } from '../../shared/http';
import { expenseKey, fromItem, toUpdateExpression } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  const expenseId = getPathId(event.pathParameters);
  if (!expenseId) {
    return notFound();
  }

  const parsed = updateExpenseInputSchema.safeParse(parseJsonBody(event.body, event.isBase64Encoded));
  if (!parsed.success) {
    return json(400, { message: 'Invalid update', errors: z.flattenError(parsed.error) });
  }

  try {
    const result = await db.send(
      new UpdateCommand({
        TableName: env.TABLE_NAME,
        Key: expenseKey(userId, expenseId),
        ...toUpdateExpression(parsed.data),
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    logger.info('Updated expense', { expenseId });
    return json(200, fromItem(result.Attributes ?? {}));
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      return notFound();
    }
    throw error;
  }
}
