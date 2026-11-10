import type { ReceiptPhotoResponse } from '@receipts-app/contracts';

/**
 * A presigned photo URL counts as stale this long before it expires, so a request
 * in flight or a slow image never lands on a link that just died.
 */
export const PHOTO_URL_RENEW_MARGIN_MS = 30_000;

/**
 * Floor for the background renewal timer. If the device clock is far ahead of the
 * API's, every URL looks stale on arrival; the floor keeps that from becoming a request loop.
 */
export const MIN_PHOTO_RENEWAL_DELAY_MS = 60_000;

export interface ReceiptPhotoLoadOptions {
  /** Skip the cache and ask the API for a new URL (retry, renewal). */
  force?: boolean;
}

/** Resolves a short-lived URL for an expense's receipt photo. */
export type ReceiptPhotoLoader = (
  expenseId: string,
  options?: ReceiptPhotoLoadOptions,
) => Promise<ReceiptPhotoResponse>;

type PhotoExpiry = Pick<ReceiptPhotoResponse, 'expiresAt'>;

/** True while the URL can still be handed to an <img> or a link with time to spare. */
export function isPhotoUrlFresh(photo: PhotoExpiry, now: number, margin = PHOTO_URL_RENEW_MARGIN_MS): boolean {
  const expiresAt = Date.parse(photo.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt - margin > now;
}

/** Milliseconds until the URL should be replaced (0 when it already should be). */
export function msUntilRenewal(photo: PhotoExpiry, now: number, margin = PHOTO_URL_RENEW_MARGIN_MS): number {
  const expiresAt = Date.parse(photo.expiresAt);
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, expiresAt - margin - now);
}

/**
 * Wraps the API call with a per-expense memory cache: reopening a receipt reuses its URL
 * while it is fresh (and the browser serves the image from its cache), concurrent requests
 * for one expense share a single call, and a failure is never cached.
 */
export function withPhotoUrlCache(
  load: (expenseId: string) => Promise<ReceiptPhotoResponse>,
  now: () => number = Date.now,
): ReceiptPhotoLoader {
  const cache = new Map<string, ReceiptPhotoResponse>();
  const pending = new Map<string, Promise<ReceiptPhotoResponse>>();

  return (expenseId, { force = false } = {}) => {
    if (!force) {
      const cached = cache.get(expenseId);
      if (cached && isPhotoUrlFresh(cached, now())) return Promise.resolve(cached);
      const inFlight = pending.get(expenseId);
      if (inFlight) return inFlight;
    }

    const request = load(expenseId).then(
      (photo) => {
        if (pending.get(expenseId) === request) pending.delete(expenseId);
        cache.set(expenseId, photo);
        return photo;
      },
      (error: unknown) => {
        if (pending.get(expenseId) === request) pending.delete(expenseId);
        cache.delete(expenseId);
        throw error;
      },
    );
    pending.set(expenseId, request);
    return request;
  };
}
