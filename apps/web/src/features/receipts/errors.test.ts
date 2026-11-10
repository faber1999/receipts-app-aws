import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { getUploadErrorKey, ReceiptStorageError } from './errors';
import { ReceiptImageError } from './prepare-image';

// api-client reads the Amplify/API env at import; only ApiError is needed here.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_USER_POOL_ID: 'us-east-2_test',
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: 'test-client',
    NEXT_PUBLIC_API_URL: 'https://api.example.test',
  },
}));

describe('getUploadErrorKey', () => {
  it('passes image problems through by code', () => {
    expect(getUploadErrorKey(new ReceiptImageError('unreadable', 'x'))).toBe('unreadable');
    expect(getUploadErrorKey(new ReceiptImageError('tooLarge', 'x'))).toBe('tooLarge');
  });

  it('separates an expired session from other API failures', () => {
    expect(getUploadErrorKey(new ApiError(401, 'x'))).toBe('unauthorized');
    expect(getUploadErrorKey(new ApiError(500, 'x'))).toBe('apiFailed');
    expect(getUploadErrorKey(new ApiError(400, 'x'))).toBe('apiFailed');
  });

  it('reports an S3 rejection', () => {
    expect(getUploadErrorKey(new ReceiptStorageError(403))).toBe('rejected');
  });

  it('treats a fetch TypeError as a network failure', () => {
    expect(getUploadErrorKey(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('falls back for anything unexpected', () => {
    expect(getUploadErrorKey(new Error('boom'))).toBe('failed');
    expect(getUploadErrorKey('nope')).toBe('failed');
  });
});
