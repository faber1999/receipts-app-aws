import type { ReceiptContentType } from '@receipts-app/contracts';

export interface ReceiptKey {
  userId: string;
  receiptId: string;
  contentType: ReceiptContentType;
}

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const satisfies Record<ReceiptContentType, string>;

const KEY_PATTERN = /^receipts\/([^/]+)\/([0-9a-f-]{36})\.(jpg|png)$/;

/** S3 key of a receipt photo. The owner is part of the key, so the S3 event alone says whose receipt it is. */
export function buildReceiptKey({ userId, receiptId, contentType }: ReceiptKey): string {
  return `receipts/${userId}/${receiptId}.${EXTENSIONS[contentType]}`;
}

/** Reverse of buildReceiptKey. Returns null for any key the app didn't create. */
export function parseReceiptKey(key: string): ReceiptKey | null {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;

  const [, userId, receiptId, extension] = match;
  if (!userId || !receiptId || !extension) return null;

  return { userId, receiptId, contentType: extension === 'jpg' ? 'image/jpeg' : 'image/png' };
}
