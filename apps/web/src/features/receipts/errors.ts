import type { Dictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api-client';
import { ReceiptImageError } from './prepare-image';

export type UploadErrorKey = keyof Dictionary['receipts']['upload']['errors'];
export type PhotoErrorKey = keyof Dictionary['receipts']['photo']['errors'];

/** S3 refused the presigned POST (expired policy, wrong type or size). */
export class ReceiptStorageError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Receipt upload rejected with ${status}`);
    this.name = 'ReceiptStorageError';
    this.status = status;
  }
}

/** Maps a failure anywhere in the upload (prepare, POST /receipts, S3) to a translated message key. */
export function getUploadErrorKey(error: unknown): UploadErrorKey {
  if (error instanceof ReceiptImageError) return error.code;
  if (error instanceof ApiError) return error.status === 401 ? 'unauthorized' : 'apiFailed';
  if (error instanceof ReceiptStorageError) return 'rejected';
  // fetch rejects with a TypeError when the request never got a response (offline, DNS, CORS or CSP).
  if (error instanceof TypeError) return 'network';
  return 'failed';
}

/** Maps a failure to get a receipt photo URL to a translated message key. */
export function getPhotoErrorKey(error: unknown): PhotoErrorKey {
  if (error instanceof ApiError) {
    // 404: the expense is gone, or it was entered by hand and never had a photo.
    if (error.status === 404) return 'notFound';
    if (error.status === 401) return 'unauthorized';
    return 'failed';
  }
  if (error instanceof TypeError) return 'network';
  return 'failed';
}
