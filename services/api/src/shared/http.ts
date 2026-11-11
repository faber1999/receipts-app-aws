import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** Parses the request body as JSON. Returns undefined when it's missing or malformed. */
export function parseJsonBody(body: string | undefined, isBase64Encoded: boolean): unknown {
  if (!body) {
    return undefined;
  }
  try {
    return JSON.parse(isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body);
  } catch {
    return undefined;
  }
}

/** Reads the {id} path parameter; returns undefined when it isn't a UUID. */
export function getPathId(pathParameters: Record<string, string | undefined> | undefined): string | undefined {
  const result = z.uuid().safeParse(pathParameters?.id);
  return result.success ? result.data : undefined;
}

export const notFound = (): APIGatewayProxyResultV2 => json(404, { message: 'Expense not found' });

export const conflict = (message: string): APIGatewayProxyResultV2 => json(409, { message });
