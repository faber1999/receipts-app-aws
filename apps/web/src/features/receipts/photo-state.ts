import type { ReceiptPhotoResponse } from '@receipts-app/contracts';
import type { PhotoErrorKey } from './errors';

/**
 * What a receipt photo shows: a placeholder while the URL is requested, the image once
 * the URL arrives (with its own load phase, since the bytes come from S3 afterwards),
 * or a translated error.
 */
export type ReceiptPhotoState =
  | { status: 'loading' }
  | { status: 'ready'; photo: ReceiptPhotoResponse; image: 'loading' | 'loaded' }
  | { status: 'error'; error: PhotoErrorKey };

export type ReceiptPhotoEvent =
  /** A first load or a retry: back to the placeholder. */
  | { type: 'requested' }
  /** A URL arrived, from a request or a background renewal. */
  | { type: 'resolved'; photo: ReceiptPhotoResponse }
  | { type: 'failed'; error: PhotoErrorKey }
  | { type: 'imageLoaded' }
  | { type: 'imageFailed' };

export const initialReceiptPhotoState: ReceiptPhotoState = { status: 'loading' };

export function receiptPhotoReducer(state: ReceiptPhotoState, event: ReceiptPhotoEvent): ReceiptPhotoState {
  switch (event.type) {
    case 'requested':
      return state.status === 'loading' ? state : { status: 'loading' };
    case 'resolved':
      // A renewal swaps the URL under a photo already on screen; it must not flash the placeholder.
      return state.status === 'ready'
        ? { ...state, photo: event.photo }
        : { status: 'ready', photo: event.photo, image: 'loading' };
    case 'failed':
      // A failed background renewal leaves the photo that is already showing.
      return state.status === 'ready' ? state : { status: 'error', error: event.error };
    case 'imageLoaded':
      return state.status === 'ready' && state.image === 'loading' ? { ...state, image: 'loaded' } : state;
    case 'imageFailed':
      return state.status === 'ready' ? { status: 'error', error: 'imageFailed' } : state;
  }
}
