import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'groceries',
  'restaurants',
  'transport',
  'health',
  'home',
  'entertainment',
  'shopping',
  'services',
  'other',
] as const;

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

export const expenseStatusSchema = z.enum(['PENDING', 'REVIEW', 'PROCESSED', 'FAILED']);

/** ISO 4217 code, e.g. COP or USD. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

const expenseBaseSchema = z.object({
  id: z.uuid(),
  /** Receipt date once processed; the upload date while pending, so it lists in the current month. */
  date: z.iso.date(),
  imageKey: z.string().optional(),
  createdAt: z.iso.datetime(),
});

export const processedExpenseSchema = expenseBaseSchema.extend({
  status: z.literal('PROCESSED'),
  merchant: z.string().trim().min(1).max(120),
  total: z.number().nonnegative(),
  currency: currencySchema,
  category: expenseCategorySchema,
});

/** A receipt that was uploaded and is waiting for (or failed) extraction: no expense data yet. */
export const unprocessedExpenseSchema = expenseBaseSchema.extend({
  status: z.enum(['PENDING', 'FAILED']),
  imageKey: z.string(),
});

/** A receipt the AI has read: whatever it could read, waiting for the person to confirm it or fill in the gaps. */
export const reviewExpenseSchema = expenseBaseSchema.extend({
  status: z.literal('REVIEW'),
  imageKey: z.string(),
  merchant: processedExpenseSchema.shape.merchant.optional(),
  total: processedExpenseSchema.shape.total.optional(),
  currency: processedExpenseSchema.shape.currency.optional(),
  category: processedExpenseSchema.shape.category.optional(),
});

export const expenseSchema = z.discriminatedUnion('status', [
  processedExpenseSchema,
  reviewExpenseSchema,
  unprocessedExpenseSchema,
]);

/** Body of POST /expenses (manual entry). The API fills id, status and createdAt. */
export const createExpenseInputSchema = processedExpenseSchema.pick({
  merchant: true,
  total: true,
  currency: true,
  date: true,
  category: true,
});

/** Body of PATCH /expenses/{id}: any non-empty subset of the editable fields. */
export const updateExpenseInputSchema = createExpenseInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, { error: 'Provide at least one field to update' });

export const listExpensesResponseSchema = z.object({
  items: z.array(expenseSchema),
});

/** Query string of GET /expenses: the calendar month to list, e.g. 2026-11. */
export const listExpensesQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type ProcessedExpense = z.infer<typeof processedExpenseSchema>;
export type UnprocessedExpense = z.infer<typeof unprocessedExpenseSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;
export type ListExpensesResponse = z.infer<typeof listExpensesResponseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ReviewExpense = z.infer<typeof reviewExpenseSchema>;
