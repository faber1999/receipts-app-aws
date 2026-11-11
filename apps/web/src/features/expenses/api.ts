import {
  type CreateExpenseInput,
  type Expense,
  expenseSchema,
  listExpensesResponseSchema,
  type ProcessedExpense,
  processedExpenseSchema,
  type UpdateExpenseInput,
} from '@receipts-app/contracts';
import { apiRequest } from '@/lib/api-client';

export async function listExpenses(month: string): Promise<Expense[]> {
  const data = listExpensesResponseSchema.parse(
    await apiRequest('GET', `/expenses?month=${encodeURIComponent(month)}`),
  );
  return data.items;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  return expenseSchema.parse(await apiRequest('POST', '/expenses', input));
}

export async function updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
  return expenseSchema.parse(await apiRequest('PATCH', `/expenses/${id}`, input));
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest('DELETE', `/expenses/${id}`);
}

/** Confirms a REVIEW receipt (or completes a FAILED one) with every field; resolves with the PROCESSED expense. */
export async function confirmExpense(id: string, input: CreateExpenseInput): Promise<ProcessedExpense> {
  return processedExpenseSchema.parse(await apiRequest('POST', `/expenses/${id}/confirm`, input));
}
