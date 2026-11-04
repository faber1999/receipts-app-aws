import { Logger } from '@aws-lambda-powertools/logger';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { getPathId, notFound } from '../../shared/http';
import { expenseKey } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);
  const expenseId = getPathId(event.pathParameters);
  if (!expenseId) {
    return notFound();
  }

  try {
    await db.send(
      new DeleteCommand({
        TableName: env.TABLE_NAME,
        Key: expenseKey(userId, expenseId),
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) {
      return notFound();
    }
    throw error;
  }

  logger.info('Deleted expense', { expenseId });
  return { statusCode: 204 };
}
