import type { Expense, ExpenseCategory } from '@receipts-app/contracts';

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number;
}

/** Totals in one currency: amounts in different currencies are never added together. */
export interface CurrencyTotal {
  currency: string;
  total: number;
  /** Largest first. */
  byCategory: CategoryTotal[];
}

export interface MonthlySummary {
  /** YYYY-MM */
  month: string;
  /** One entry per currency, sorted by currency code. */
  totals: CurrencyTotal[];
  /** Confirmed (PROCESSED) expenses: the only ones that count in the totals. */
  expenseCount: number;
  /** REVIEW and FAILED receipts the person still has to confirm. */
  needsAttention: number;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  groceries: 'Groceries',
  restaurants: 'Restaurants',
  transport: 'Transport',
  health: 'Health',
  home: 'Home',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  services: 'Services',
  other: 'Other',
};

/** The month before `now` (UTC), as YYYY-MM. Runs on the 1st, so it summarizes the month that just ended. */
export function previousMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

/** Avoids floating-point noise such as 0.1 + 0.2 = 0.30000000000000004. */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function buildMonthlySummary(month: string, expenses: Expense[]): MonthlySummary {
  const byCurrency = new Map<string, Map<ExpenseCategory, number>>();
  let expenseCount = 0;
  let needsAttention = 0;

  for (const expense of expenses) {
    if (expense.status === 'REVIEW' || expense.status === 'FAILED') {
      needsAttention += 1;
      continue;
    }
    // PENDING receipts are still being read: they belong to no summary yet.
    if (expense.status !== 'PROCESSED') continue;

    expenseCount += 1;
    const categories = byCurrency.get(expense.currency) ?? new Map<ExpenseCategory, number>();
    categories.set(expense.category, (categories.get(expense.category) ?? 0) + expense.total);
    byCurrency.set(expense.currency, categories);
  }

  const totals = [...byCurrency]
    .map(([currency, categories]): CurrencyTotal => {
      const byCategory = [...categories]
        .map(([category, total]) => ({ category, total: roundMoney(total) }))
        .sort((a, b) => b.total - a.total);
      const total = roundMoney(byCategory.reduce((sum, item) => sum + item.total, 0));
      return { currency, total, byCategory };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return { month, totals, expenseCount, needsAttention };
}

/** Nothing confirmed and nothing waiting: no email is sent. */
export function isEmptySummary(summary: MonthlySummary): boolean {
  return summary.expenseCount === 0 && summary.needsAttention === 0;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function renderSummaryEmail(summary: MonthlySummary): { subject: string; text: string } {
  const monthName = new Date(`${summary.month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const lines = [`Your expenses for ${monthName}`, ''];

  if (summary.expenseCount === 0) {
    lines.push('No confirmed expenses this month.', '');
  }
  for (const { currency, total, byCategory } of summary.totals) {
    lines.push(`Total: ${formatMoney(total, currency)}`);
    for (const item of byCategory) {
      lines.push(`  ${CATEGORY_LABELS[item.category]}: ${formatMoney(item.total, currency)}`);
    }
    lines.push('');
  }

  if (summary.needsAttention > 0) {
    const receipts = summary.needsAttention === 1 ? '1 receipt is' : `${summary.needsAttention} receipts are`;
    lines.push(`${receipts} waiting for your review and not counted above.`);
  }

  return { subject: `Receipts App: your ${monthName} summary`, text: lines.join('\n').trimEnd() };
}
