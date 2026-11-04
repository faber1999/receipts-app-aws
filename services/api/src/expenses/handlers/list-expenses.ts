import { Logger } from '@aws-lambda-powertools/logger';
import { paginateQuery } from '@aws-sdk/lib-dynamodb';
import { type Expense, type ListExpensesResponse, listExpensesQuerySchema } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getUserId } from '../../shared/auth';
import { db } from '../../shared/db';
import { env } from '../../shared/env';
import { json } from '../../shared/http';
import { dateSk, fromItem, userPk } from '../expense-repository';

const logger = new Logger({ serviceName: 'expenses-api' });

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);

  const query = listExpensesQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!query.success) {
    return json(400, { message: 'Invalid query', errors: z.flattenError(query.error).fieldErrors });
  }

  // GSI1SK is DATE#yyyy-mm-dd, so "begins with DATE#yyyy-mm" selects exactly one month.
  const pages = paginateQuery(
    { client: db },
    {
      TableName: env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :month)',
      ExpressionAttributeValues: {
        ':pk': userPk(userId),
        ':month': dateSk(query.data.month),
      },
      ScanIndexForward: false,
    },
  );

  const items: Expense[] = [];
  let pageCount = 0;
  for await (const page of pages) {
    pageCount += 1;
    items.push(...(page.Items ?? []).map(fromItem));
  }

  const body: ListExpensesResponse = { items };
  logger.info('Listed expenses', { month: query.data.month, count: items.length, pages: pageCount });

  return json(200, body);
}
