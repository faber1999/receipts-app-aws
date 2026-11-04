import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Created once per Lambda container and reused across invocations (warm starts).
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
