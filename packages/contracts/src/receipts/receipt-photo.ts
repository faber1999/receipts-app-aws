import { z } from 'zod';

/** Response of GET /expenses/{id}/receipt: a short-lived URL to view the photo. */
export const receiptPhotoResponseSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export type ReceiptPhotoResponse = z.infer<typeof receiptPhotoResponseSchema>;
