'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getPhotoErrorKey } from './errors';
import { initialReceiptPhotoState, type ReceiptPhotoState, receiptPhotoReducer } from './photo-state';
import { MIN_PHOTO_RENEWAL_DELAY_MS, msUntilRenewal, type ReceiptPhotoLoader } from './photo-url';

export interface ReceiptPhotoController {
  state: ReceiptPhotoState;
  /** Asks the API for a new URL and shows the placeholder again. */
  retry: () => void;
  onImageLoad: () => void;
  onImageError: () => void;
}

/**
 * Requests the photo URL of one expense and keeps it usable while shown: the URL is
 * renewed shortly before it expires, and an image that fails to load gets one silent
 * attempt with a new URL before the error shows. Mount it per display (e.g. keyed by a
 * dialog session) and pass `active: false` while hidden, so nothing is fetched or renewed.
 */
export function useReceiptPhoto(
  expenseId: string,
  loadPhoto: ReceiptPhotoLoader,
  active = true,
): ReceiptPhotoController {
  const [state, dispatch] = useReducer(receiptPhotoReducer, initialReceiptPhotoState);
  // A new object per request, so the effect below reruns even for a repeated force.
  const [request, setRequest] = useState({ force: false });
  const silentRetryUsed = useRef(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    dispatch({ type: 'requested' });
    loadPhoto(expenseId, { force: request.force }).then(
      (photo) => {
        if (current) dispatch({ type: 'resolved', photo });
      },
      (error: unknown) => {
        if (current) dispatch({ type: 'failed', error: getPhotoErrorKey(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [expenseId, loadPhoto, request, active]);

  const expiresAt = state.status === 'ready' ? state.photo.expiresAt : null;

  useEffect(() => {
    if (!active || expiresAt === null) return;
    let current = true;
    const delay = Math.max(MIN_PHOTO_RENEWAL_DELAY_MS, msUntilRenewal({ expiresAt }, Date.now()));
    const timer = window.setTimeout(() => {
      loadPhoto(expenseId, { force: true }).then(
        (photo) => {
          if (current) dispatch({ type: 'resolved', photo });
        },
        // Keep the current URL: the photo is already on screen, and a failed image retries on its own.
        () => undefined,
      );
    }, delay);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [expenseId, expiresAt, loadPhoto, active]);

  const retry = useCallback(() => {
    silentRetryUsed.current = false;
    setRequest({ force: true });
  }, []);

  const onImageLoad = useCallback(() => {
    silentRetryUsed.current = false;
    dispatch({ type: 'imageLoaded' });
  }, []);

  const onImageError = useCallback(() => {
    // Most likely an expired link (a sleeping tab, a skewed clock): try once more with a new one.
    if (!silentRetryUsed.current) {
      silentRetryUsed.current = true;
      setRequest({ force: true });
      return;
    }
    dispatch({ type: 'imageFailed' });
  }, []);

  return { state, retry, onImageLoad, onImageError };
}
