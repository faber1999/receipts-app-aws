import type { Expense, ExpenseCategory } from '@receipts-app/contracts';

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

/** The months the switcher can reach: from the oldest expense to the newest, always including this month. */
export function monthBounds(expenses: readonly Expense[], current: MonthKey): { min: MonthKey; max: MonthKey } {
  let min = current;
  let max = current;
  for (const expense of expenses) {
    const key = monthKeyOf(expense.date);
    if (key < min) min = key;
    if (key > max) max = key;
  }
  return { min, max };
}

/** Newest first; same day falls back to the most recently created. */
export function sortExpenses(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function expensesInMonth(expenses: readonly Expense[], key: MonthKey): Expense[] {
  return sortExpenses(expenses.filter((expense) => monthKeyOf(expense.date) === key));
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
  /** One entry per currency: amounts in different currencies are never added together. */
  currencies: CurrencySummary[];
  /** FAILED receipts carry no reliable amount, so they are left out of the totals. */
  failedCount: number;
}

export function summarizeMonth(expenses: readonly Expense[]): MonthSummary {
  const byCurrency = new Map<string, { total: number; count: number; categories: Map<ExpenseCategory, number> }>();
  let failedCount = 0;

  for (const expense of expenses) {
    if (expense.status === 'FAILED') {
      failedCount += 1;
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

  return { currencies, failedCount };
}
