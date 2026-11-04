import type { Dictionary } from '@/i18n/dictionaries';
import { ApiError } from '@/lib/api-client';

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
