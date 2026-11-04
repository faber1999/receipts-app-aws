import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';

/**
 * The user id is the Cognito `sub` claim of the JWT that API Gateway already verified.
 * Never take it from the path, query or body: that would let a user read someone else's data.
 */
export function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return z.string().min(1).parse(event.requestContext.authorizer.jwt.claims.sub);
}
