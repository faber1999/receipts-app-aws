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

export const expenseStatusSchema = z.enum(['PENDING', 'PROCESSED', 'FAILED']);

/** ISO 4217 code, e.g. COP or USD. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const expenseSchema = z.object({
  id: z.uuid(),
  merchant: z.string().trim().min(1).max(120),
  total: z.number().nonnegative(),
  currency: currencySchema,
  date: z.iso.date(),
  category: expenseCategorySchema,
  status: expenseStatusSchema,
  imageKey: z.string().optional(),
  createdAt: z.iso.datetime(),
});

/** Body of POST /expenses. The API fills id, status and createdAt. */
export const createExpenseInputSchema = expenseSchema.pick({
  merchant: true,
  total: true,
  currency: true,
  date: true,
  category: true,
});

/** Body of PATCH /expenses/{id}: any subset of the editable fields. */
export const updateExpenseInputSchema = createExpenseInputSchema.partial();

export const listExpensesResponseSchema = z.object({
  items: z.array(expenseSchema),
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;
export type ListExpensesResponse = z.infer<typeof listExpensesResponseSchema>;
