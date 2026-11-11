import { z } from 'zod';
import type { Dictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api-client';
import { EXPENSE_FIELDS, type ExpenseField, type ExpenseFieldErrors, type ValidationKey } from './schemas';

export type ExpenseErrorKey = keyof Dictionary['expenses']['apiErrors'];

export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

/** Maps an API failure to a translated message key; anything unexpected uses the action's fallback. */
export function getExpenseErrorKey(error: unknown, fallback: 'saveFailed' | 'deleteFailed'): ExpenseErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'invalid';
    if (error.status === 401) return 'unauthorized';
    if (error.status === 404) return 'notFound';
  }
  return fallback;
}

/** POST /expenses/{id}/confirm adds 409: the receipt is no longer waiting (confirmed or changed elsewhere). */
export function getConfirmErrorKey(error: unknown): ExpenseErrorKey {
  return isApiStatus(error, 409) ? 'confirmConflict' : getExpenseErrorKey(error, 'saveFailed');
}

/** The 400 body of the expense endpoints: `z.flattenError(...).fieldErrors` under `errors`. */
const validationBodySchema = z.object({
  errors: z.record(z.string(), z.unknown()),
});

/** The API's messages are English and technical; each rejected field gets the form's own message instead. */
const FIELD_ERROR_KEYS: Record<ExpenseField, ValidationKey> = {
  merchant: 'merchantRequired',
  total: 'totalInvalid',
  currency: 'currencyInvalid',
  date: 'dateInvalid',
  category: 'categoryInvalid',
};

/** The fields a 400 response rejected, as form errors; empty for anything else. */
export function apiFieldErrors(error: unknown): ExpenseFieldErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const parsed = validationBodySchema.safeParse(error.body);
  if (!parsed.success) return {};

  const errors: ExpenseFieldErrors = {};
  for (const field of EXPENSE_FIELDS) {
    if (parsed.data.errors[field] !== undefined) errors[field] = FIELD_ERROR_KEYS[field];
  }
  return errors;
}
