import type { ReceiptPhotoResponse } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { initialReceiptPhotoState, type ReceiptPhotoState, receiptPhotoReducer } from './photo-state';

const first: ReceiptPhotoResponse = {
  url: 'https://bucket.example.com/r.jpg?sig=1',
  expiresAt: '2026-11-09T12:05:00.000Z',
};
const renewed: ReceiptPhotoResponse = {
  url: 'https://bucket.example.com/r.jpg?sig=2',
  expiresAt: '2026-11-09T12:10:00.000Z',
};

const loaded: ReceiptPhotoState = { status: 'ready', photo: first, image: 'loaded' };

describe('receiptPhotoReducer', () => {
  it('waits for the image itself after the URL arrives', () => {
    const state = receiptPhotoReducer(initialReceiptPhotoState, { type: 'resolved', photo: first });
    expect(state).toEqual({ status: 'ready', photo: first, image: 'loading' });
    expect(receiptPhotoReducer(state, { type: 'imageLoaded' })).toEqual(loaded);
  });

  it('swaps a renewed URL in without hiding the photo', () => {
    expect(receiptPhotoReducer(loaded, { type: 'resolved', photo: renewed })).toEqual({
      status: 'ready',
      photo: renewed,
      image: 'loaded',
    });
  });

  it('keeps the photo on screen when a background renewal fails', () => {
    expect(receiptPhotoReducer(loaded, { type: 'failed', error: 'network' })).toBe(loaded);
  });

  it('shows the error when the URL request fails', () => {
    expect(receiptPhotoReducer(initialReceiptPhotoState, { type: 'failed', error: 'notFound' })).toEqual({
      status: 'error',
      error: 'notFound',
    });
  });

  it('turns an image that fails to load into an error', () => {
    const state = receiptPhotoReducer({ status: 'ready', photo: first, image: 'loading' }, { type: 'imageFailed' });
    expect(state).toEqual({ status: 'error', error: 'imageFailed' });
  });

  it('goes back to the placeholder on retry', () => {
    expect(receiptPhotoReducer({ status: 'error', error: 'failed' }, { type: 'requested' })).toEqual({
      status: 'loading',
    });
  });

  it('ignores image events that no longer apply', () => {
    expect(receiptPhotoReducer(loaded, { type: 'imageLoaded' })).toBe(loaded);
    expect(receiptPhotoReducer(initialReceiptPhotoState, { type: 'imageFailed' })).toBe(initialReceiptPhotoState);
  });
});
