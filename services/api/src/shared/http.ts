import type { APIGatewayProxyResultV2 } from 'aws-lambda';

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
