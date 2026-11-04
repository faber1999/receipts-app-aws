import { randomUUID } from 'node:crypto';
import { Logger } from '@aws-lambda-powertools/logger';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { createExpenseInputSchema, type Expense } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { json, parseJsonBody } from '../../shared/http';
import { toItem } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);

  const parsed = createExpenseInputSchema.safeParse(parseJsonBody(event.body, event.isBase64Encoded));
  if (!parsed.success) {
    return json(400, { message: 'Invalid expense', errors: z.flattenError(parsed.error).fieldErrors });
  }

  const expense: Expense = {
    ...parsed.data,
    id: randomUUID(),
    status: 'PROCESSED',
    createdAt: new Date().toISOString(),
  };

  await db.send(
    new PutCommand({
      TableName: env.TABLE_NAME,
      Item: toItem(userId, expense),
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );

  logger.info('Created expense', { expenseId: expense.id });
  return json(201, expense);
}
