import { z } from 'zod';
import { createExpenseInputSchema } from '../expenses/expense';

/**
 * What the AI extracts from a receipt photo.
 * `expense` is null when the image is not a readable receipt; `unreadableReason` says why.
 */
export const receiptExtractionSchema = z.object({
  expense: createExpenseInputSchema.nullable(),
  unreadableReason: z.string().nullable(),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;
