import type { Expense } from '@receipts-app/contracts';
import { isApiStatus } from './errors';
import { applyExpenseChange, type ExpenseChange, type MonthKey } from './month';

export type MonthEntry =
  | { status: 'loading' }
  | { status: 'error'; unauthorized: boolean }
  | { status: 'ready'; items: Expense[] };

export type ListMonth = (month: MonthKey) => Promise<Expense[]>;

const LOADING: MonthEntry = { status: 'loading' };

/**
 * In-memory, per-session cache of each month's expenses (GET /expenses?month=YYYY-MM).
 *
 * - Each month is fetched once; switching back to it renders from memory.
 * - Responses are keyed by month and by request: a late answer for another month only
 *   fills that month's slot, and a superseded request for the same month is ignored.
 * - Local saves and deletes patch every loaded month right away. Months still loading,
 *   failed, or about to be fetched queue the change and replay it on their next response,
 *   so a read that lags behind a write (DynamoDB GSIs are eventually consistent) never
 *   hides what the user just saved.
 *
 * Built for useSyncExternalStore: entries are immutable, so `get` is a stable snapshot.
 */
export class MonthExpensesStore {
  private entries = new Map<MonthKey, MonthEntry>();
  private latestRequest = new Map<MonthKey, number>();
  private pending = new Map<MonthKey, ExpenseChange[]>();
  private requestSeq = 0;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(month: MonthKey): MonthEntry | undefined {
    return this.entries.get(month);
  }

  /** Fetches the month unless it is already cached or on its way. */
  ensure(month: MonthKey, list: ListMonth): void {
    if (!this.entries.has(month)) this.load(month, list);
  }

  /** Fetches the month now (first load or retry); an older request for it is superseded. */
  load(month: MonthKey, list: ListMonth): void {
    const request = ++this.requestSeq;
    this.latestRequest.set(month, request);
    this.set(month, LOADING);

    list(month).then(
      (items) => {
        if (this.latestRequest.get(month) !== request) return;
        const queued = this.pending.get(month) ?? [];
        this.pending.delete(month);
        this.set(month, {
          status: 'ready',
          items: queued.reduce((current, change) => applyExpenseChange(current, month, change), items),
        });
      },
      (error: unknown) => {
        if (this.latestRequest.get(month) !== request) return;
        // Queued changes stay for the retry.
        this.set(month, { status: 'error', unauthorized: isApiStatus(error, 401) });
      },
    );
  }

  /**
   * Applies a saved or deleted expense to every month: loaded ones are patched now, the
   * rest replay it on arrival. `target` is the month the UI is about to open, which may
   * have no entry yet.
   */
  apply(change: ExpenseChange, target?: MonthKey): void {
    const months = new Set(this.entries.keys());
    if (target) months.add(target);

    for (const month of months) {
      const entry = this.entries.get(month);
      if (entry?.status === 'ready') {
        this.entries.set(month, { status: 'ready', items: applyExpenseChange(entry.items, month, change) });
      } else {
        this.pending.set(month, [...(this.pending.get(month) ?? []), change]);
      }
    }
    this.emit();
  }

  private set(month: MonthKey, entry: MonthEntry): void {
    this.entries.set(month, entry);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
