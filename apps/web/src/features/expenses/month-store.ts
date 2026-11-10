import type { Expense } from '@receipts-app/contracts';
import { isApiStatus } from './errors';
import { applyExpenseChange, type ExpenseChange, type MonthKey, monthKeyOf } from './month';

export type MonthEntry =
  | { status: 'loading' }
  | { status: 'error'; unauthorized: boolean }
  | { status: 'ready'; items: Expense[] };

export type ListMonth = (month: MonthKey) => Promise<Expense[]>;

const LOADING: MonthEntry = { status: 'loading' };

/**
 * How long a local change is trusted over a background refresh. A read sent shortly after
 * a write may not reflect it yet (DynamoDB GSIs are eventually consistent).
 */
export const LAG_GRACE_MS = 5000;

interface RecentChange {
  change: ExpenseChange;
  at: number;
}

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
 * - Background refreshes (polling for receipts being read) keep the month on screen and
 *   replay local changes made within LAG_GRACE_MS, so a lagging read cannot undo them either.
 *
 * Built for useSyncExternalStore: entries are immutable, so `get` is a stable snapshot.
 */
export class MonthExpensesStore {
  private entries = new Map<MonthKey, MonthEntry>();
  private latestRequest = new Map<MonthKey, number>();
  private pending = new Map<MonthKey, ExpenseChange[]>();
  private recent: RecentChange[] = [];
  private requestSeq = 0;
  private listeners = new Set<() => void>();
  private readonly now: () => number;

  /** `now` is injectable for tests. */
  constructor(now: () => number = Date.now) {
    this.now = now;
  }

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
   * Refetches a loaded month in the background: the current list stays on screen, and only a
   * 401 turns it into an error (anything else keeps the last list; the next poll tries again).
   * Resolves once the response is applied or ignored. Does nothing unless the month is ready.
   */
  refresh(month: MonthKey, list: ListMonth): Promise<void> {
    if (this.entries.get(month)?.status !== 'ready') return Promise.resolve();
    const request = ++this.requestSeq;
    this.latestRequest.set(month, request);
    const sentAt = this.now();

    return list(month).then(
      (items) => {
        if (this.latestRequest.get(month) !== request) return;
        this.set(month, { status: 'ready', items: this.replayRecent(month, items, sentAt) });
      },
      (error: unknown) => {
        if (this.latestRequest.get(month) !== request) return;
        if (isApiStatus(error, 401)) this.set(month, { status: 'error', unauthorized: true });
      },
    );
  }

  /**
   * Forgets every cached month except `keep`; each is fetched again the next time it is shown.
   * Used when the server moved an expense to a month we cannot name (a receipt filed under its date).
   */
  invalidateExcept(keep: MonthKey): void {
    for (const month of [...this.entries.keys()]) {
      if (month === keep) continue;
      this.entries.delete(month);
      // Any request still on its way for that month is ignored when it lands.
      this.latestRequest.delete(month);
    }
    this.emit();
  }

  /**
   * Applies a saved or deleted expense to every month: loaded ones are patched now, the
   * rest replay it on arrival. `target` is the month the UI is about to open, which may
   * have no entry yet.
   */
  apply(change: ExpenseChange, target?: MonthKey): void {
    this.recent = [...this.pruneRecent(), { change, at: this.now() }];
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

  /**
   * Replays recent local changes over a refresh response. A change made after the request was
   * sent cannot be in it, so it always wins. An older one only covers for a lagging read: an
   * upsert into this month is replayed only when the response lacks the expense entirely, so a
   * server-side update (e.g. a receipt that was just read) is never overwritten by a stale copy.
   */
  private replayRecent(month: MonthKey, items: Expense[], sentAt: number): Expense[] {
    const served = new Set(items.map((expense) => expense.id));
    return this.pruneRecent().reduce((current, { change, at }) => {
      const landsHere = change.type === 'upsert' && monthKeyOf(change.expense.date) === month;
      if (at < sentAt && landsHere && served.has(change.expense.id)) return current;
      return applyExpenseChange(current, month, change);
    }, items);
  }

  private pruneRecent(): RecentChange[] {
    const cutoff = this.now() - LAG_GRACE_MS;
    this.recent = this.recent.filter(({ at }) => at >= cutoff);
    return this.recent;
  }

  private set(month: MonthKey, entry: MonthEntry): void {
    this.entries.set(month, entry);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
