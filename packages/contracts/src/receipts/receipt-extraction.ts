import { z } from 'zod';
import { createExpenseInputSchema } from '../expenses/expense';

const fields = createExpenseInputSchema.shape;

/** The expense fields the AI could read. Each one is null when it was missing, illegible or ambiguous. */
export const extractedExpenseSchema = z.object({
  merchant: fields.merchant.nullable(),
  total: fields.total.nullable(),
  currency: fields.currency.nullable(),
  date: fields.date.nullable(),
  category: fields.category.nullable(),
});

/**
 * What the AI extracts from a receipt photo.
 * `expense` is null only when the image is not a receipt; `unreadableReason` says why.
 */
export const receiptExtractionSchema = z.object({
  expense: extractedExpenseSchema.nullable(),
  unreadableReason: z.string().nullable(),
});

export type ExtractedExpense = z.infer<typeof extractedExpenseSchema>;
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;
