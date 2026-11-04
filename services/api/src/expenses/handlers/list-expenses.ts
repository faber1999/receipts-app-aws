import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ListExpensesResponse } from '@receipts-app/contracts';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../../shared/auth';
import { env } from '../../shared/env';
import { json } from '../../shared/http';
import { fromItem, userPk } from '../expense-repository';

// Created outside the handler so they are reused across invocations (warm starts).
const logger = new Logger({ serviceName: 'expenses-api' });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  const userId = getUserId(event);

  const result = await db.send(
    new QueryCommand({
      TableName: env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': userPk(userId) },
      ScanIndexForward: false,
    }),
  );

  const body: ListExpensesResponse = { items: (result.Items ?? []).map(fromItem) };
  logger.info('Listed expenses', { count: body.items.length });

  return json(200, body);
}
