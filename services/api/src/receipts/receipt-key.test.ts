import { describe, expect, it } from 'vitest';
import { buildReceiptKey, parseReceiptKey } from './receipt-key';

const RECEIPT = {
  userId: '440824d8-b081-704f-1b4c-566573e4d2a0',
  receiptId: '9b2f6c1e-7d4a-4e8b-a1c3-5f6e7d8c9b0a',
  contentType: 'image/jpeg',
} as const;

describe('receipt keys', () => {
  it('builds the key under the owner', () => {
    expect(buildReceiptKey(RECEIPT)).toBe(`receipts/${RECEIPT.userId}/${RECEIPT.receiptId}.jpg`);
  });

  it('parses back what it builds', () => {
    expect(parseReceiptKey(buildReceiptKey(RECEIPT))).toEqual(RECEIPT);
    expect(parseReceiptKey(buildReceiptKey({ ...RECEIPT, contentType: 'image/png' }))).toEqual({
      ...RECEIPT,
      contentType: 'image/png',
    });
  });

  it.each([
    'test/receipt.jpeg',
    `receipts/${RECEIPT.userId}/not-a-uuid.jpg`,
    `receipts/${RECEIPT.userId}/${RECEIPT.receiptId}.gif`,
    `receipts/a/b/${RECEIPT.receiptId}.jpg`,
  ])('rejects %s', (key) => {
    expect(parseReceiptKey(key)).toBeNull();
  });
});
