import { fetchAuthSession } from 'aws-amplify/auth';
import { env } from '@/lib/env';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Calls the receipts API with the signed-in user's access token. Returns the parsed JSON body (or undefined for 204). */
export async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  // Returns a valid access token; Amplify refreshes it with the refresh token when it has expired.
  const { tokens } = await fetchAuthSession();
  const accessToken = tokens?.accessToken.toString();
  if (!accessToken) {
    throw new ApiError(401, 'Not signed in');
  }

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`);
  }
  return response.status === 204 ? undefined : response.json();
}
