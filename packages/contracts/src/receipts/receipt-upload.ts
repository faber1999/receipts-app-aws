import { z } from 'zod';
import { unprocessedExpenseSchema } from '../expenses/expense';

/** Photo formats the app accepts and the AI model can read. */
export const RECEIPT_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

/** Upper bound for a receipt photo; enforced by the S3 POST policy, not just the client. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const receiptContentTypeSchema = z.enum(RECEIPT_CONTENT_TYPES);

/** Body of POST /receipts. */
export const createReceiptUploadInputSchema = z.object({
  contentType: receiptContentTypeSchema,
});

/** The pending expense plus a presigned POST: send `fields` and then the file as multipart form data to `url`. */
export const createReceiptUploadResponseSchema = z.object({
  expense: unprocessedExpenseSchema,
  upload: z.object({
    url: z.url(),
    fields: z.record(z.string(), z.string()),
  }),
});

export type ReceiptContentType = z.infer<typeof receiptContentTypeSchema>;
export type CreateReceiptUploadInput = z.infer<typeof createReceiptUploadInputSchema>;
export type CreateReceiptUploadResponse = z.infer<typeof createReceiptUploadResponseSchema>;
