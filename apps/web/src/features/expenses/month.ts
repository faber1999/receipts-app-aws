import type { Expense, ExpenseCategory } from '@receipts-app/contracts';
import { isProcessed } from './status';

/** Calendar month as YYYY-MM. */
export type MonthKey = string;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Today in the visitor's time zone, as YYYY-MM-DD. */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return todayIsoDate(now).slice(0, 7);
}

export function monthKeyOf(isoDate: string): MonthKey {
  return isoDate.slice(0, 7);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1 + delta;
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Newest first; same day falls back to the most recently created. */
export function sortExpenses(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * A local change to replay on a month's list. Both are idempotent by id, so replaying one
 * over a response that already reflects it is harmless.
 */
export type ExpenseChange = { type: 'upsert'; expense: Expense } | { type: 'remove'; id: string };

/** Applies a change to one month's list; an upsert only lands in the month its date belongs to. */
export function applyExpenseChange(items: readonly Expense[], month: MonthKey, change: ExpenseChange): Expense[] {
  const id = change.type === 'upsert' ? change.expense.id : change.id;
  const rest = items.filter((expense) => expense.id !== id);
  if (change.type === 'upsert' && monthKeyOf(change.expense.date) === month) {
    return sortExpenses([change.expense, ...rest]);
  }
  return rest;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number;
  /** Share of the currency total, 0..1. */
  share: number;
}

export interface CurrencySummary {
  currency: string;
  total: number;
  count: number;
  categories: CategoryTotal[];
}

export interface MonthSummary {
  /** One entry per currency, PROCESSED expenses only: amounts in different currencies are never added together. */
  currencies: CurrencySummary[];
  /** Receipts still being read; they have no amount yet, so they are left out of the totals. */
  pendingCount: number;
  /** Receipts the AI read but the person has not confirmed; left out of the totals until they are. */
  reviewCount: number;
  /** Receipts that could not be read; no amount, so they are left out of the totals. */
  failedCount: number;
}

export function summarizeMonth(expenses: readonly Expense[]): MonthSummary {
  const byCurrency = new Map<string, { total: number; count: number; categories: Map<ExpenseCategory, number> }>();
  let pendingCount = 0;
  let reviewCount = 0;
  let failedCount = 0;

  for (const expense of expenses) {
    // Only confirmed expenses count: a REVIEW amount may still be wrong, and the others have none.
    if (!isProcessed(expense)) {
      if (expense.status === 'PENDING') pendingCount += 1;
      else if (expense.status === 'REVIEW') reviewCount += 1;
      else failedCount += 1;
      continue;
    }
    let group = byCurrency.get(expense.currency);
    if (!group) {
      group = { total: 0, count: 0, categories: new Map() };
      byCurrency.set(expense.currency, group);
    }
    group.total += expense.total;
    group.count += 1;
    group.categories.set(expense.category, (group.categories.get(expense.category) ?? 0) + expense.total);
  }

  const currencies = [...byCurrency.entries()]
    .map(([currency, group]) => ({
      currency,
      total: group.total,
      count: group.count,
      categories: [...group.categories.entries()]
        .map(([category, total]) => ({ category, total, share: group.total > 0 ? total / group.total : 0 }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));

  return { currencies, pendingCount, reviewCount, failedCount };
}
