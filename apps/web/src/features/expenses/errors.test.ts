import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { apiFieldErrors, getConfirmErrorKey } from './errors';

// api-client reads the Amplify/API env at import; only ApiError is needed here.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_USER_POOL_ID: 'us-east-2_test',
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: 'test-client',
    NEXT_PUBLIC_API_URL: 'https://api.example.test',
  },
}));

describe('getConfirmErrorKey', () => {
  it('explains a 409 as a receipt that changed elsewhere', () => {
    expect(getConfirmErrorKey(new ApiError(409, 'conflict'))).toBe('confirmConflict');
  });

  it('keeps the shared mapping for the other statuses', () => {
    expect(getConfirmErrorKey(new ApiError(400, 'bad'))).toBe('invalid');
    expect(getConfirmErrorKey(new ApiError(401, 'gone'))).toBe('unauthorized');
    expect(getConfirmErrorKey(new ApiError(404, 'missing'))).toBe('notFound');
    expect(getConfirmErrorKey(new TypeError('Failed to fetch'))).toBe('saveFailed');
  });
});

describe('apiFieldErrors', () => {
  it('maps each field the API rejected to the form message for it', () => {
    const error = new ApiError(400, 'bad', {
      message: 'Invalid expense',
      errors: { total: ['Too small'], date: ['Invalid ISO date'], unknown: ['ignored'] },
    });
    expect(apiFieldErrors(error)).toEqual({ total: 'totalInvalid', date: 'dateInvalid' });
  });

  it('is empty when the body has no field errors', () => {
    expect(apiFieldErrors(new ApiError(400, 'bad', { message: 'Invalid expense' }))).toEqual({});
    expect(apiFieldErrors(new ApiError(400, 'bad'))).toEqual({});
  });

  it('is empty for anything but a 400', () => {
    expect(apiFieldErrors(new ApiError(409, 'conflict', { errors: { total: ['x'] } }))).toEqual({});
    expect(apiFieldErrors(new Error('network'))).toEqual({});
  });
});
