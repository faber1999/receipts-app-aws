import {
  type CreateExpenseInput,
  createExpenseInputSchema,
  type Expense,
  type UpdateExpenseInput,
} from '@receipts-app/contracts';
import type { Dictionary } from '@/i18n/dictionaries';

export type ValidationKey = keyof Dictionary['validation'];

export const EXPENSE_FIELDS = ['merchant', 'total', 'currency', 'date', 'category'] as const;
export type ExpenseField = (typeof EXPENSE_FIELDS)[number];
export type ExpenseFieldErrors = Partial<Record<ExpenseField, ValidationKey>>;

/** Currencies offered in the form; an expense in another currency keeps its own as an extra option. */
export const FORM_CURRENCIES = ['COP', 'USD', 'EUR'] as const;
export const DEFAULT_CURRENCY = 'COP';

export type ParsedExpenseForm =
  | { success: true; data: CreateExpenseInput }
  | { success: false; errors: ExpenseFieldErrors };

function isExpenseField(value: unknown): value is ExpenseField {
  return typeof value === 'string' && (EXPENSE_FIELDS as readonly string[]).includes(value);
}

/** The contract schema's messages are for the API; map each failing field to a translated dictionary key. */
function errorKeyFor(field: ExpenseField, code: string): ValidationKey {
  switch (field) {
    case 'merchant':
      return code === 'too_big' ? 'merchantTooLong' : 'merchantRequired';
    case 'total':
      return 'totalInvalid';
    case 'currency':
      return 'currencyInvalid';
    case 'date':
      return 'dateInvalid';
    case 'category':
      return 'categoryInvalid';
  }
}

function readText(formData: FormData, name: ExpenseField): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** Validates the expense form with the shared contract schema. */
export function parseExpenseForm(formData: FormData): ParsedExpenseForm {
  const totalText = readText(formData, 'total').trim();
  const parsed = createExpenseInputSchema.safeParse({
    merchant: readText(formData, 'merchant'),
    // An empty field must fail as "no amount", not coerce to 0.
    total: totalText === '' ? Number.NaN : Number(totalText),
    currency: readText(formData, 'currency'),
    date: readText(formData, 'date'),
    category: readText(formData, 'category'),
  });

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const errors: ExpenseFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (isExpenseField(field) && !errors[field]) {
      errors[field] = errorKeyFor(field, issue.code);
    }
  }
  return { success: false, errors };
}

/** Only the fields that changed, so a PATCH never rewrites what the user did not touch. */
export function changedFields(expense: Expense, input: CreateExpenseInput): UpdateExpenseInput {
  const changes: UpdateExpenseInput = {};
  if (input.merchant !== expense.merchant) changes.merchant = input.merchant;
  if (input.total !== expense.total) changes.total = input.total;
  if (input.currency !== expense.currency) changes.currency = input.currency;
  if (input.date !== expense.date) changes.date = input.date;
  if (input.category !== expense.category) changes.category = input.category;
  return changes;
}
