import {
  type CreateExpenseInput,
  type Expense,
  expenseSchema,
  listExpensesResponseSchema,
  type UpdateExpenseInput,
} from '@receipts-app/contracts';
import { apiRequest } from '@/lib/api-client';

export async function listExpenses(): Promise<Expense[]> {
  const data = listExpensesResponseSchema.parse(await apiRequest('GET', '/expenses'));
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
