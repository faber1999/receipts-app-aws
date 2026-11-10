'use client';

import type { Expense } from '@receipts-app/contracts';
import { useEffect, useEffectEvent } from 'react';
import type { MonthKey } from './month';
import type { ListMonth, MonthExpensesStore } from './month-store';
import { POLL_INTERVAL_MS, shouldKeepPolling } from './polling';

export interface UseMonthPollingOptions {
  store: MonthExpensesStore;
  /** The month on screen; switching months stops the loop (a new one starts if it needs it). */
  month: MonthKey;
  list: ListMonth;
  /** Whether the month has receipts still being read. */
  enabled: boolean;
  /** Bumped on every upload, so a new receipt restarts the window even if polling had given up. */
  restartKey: number;
  /** After each applied refresh, with the month's list just before and just after it. */
  onRefreshed: (month: MonthKey, before: readonly Expense[], after: readonly Expense[]) => void;
}

/**
 * Refetches the visible month every POLL_INTERVAL_MS while it holds PENDING receipts, for at
 * most POLL_WINDOW_MS. One request at a time (the next is scheduled after the previous lands),
 * and the loop stops on unmount or month change.
 */
export function useMonthPolling({ store, month, list, enabled, restartKey, onRefreshed }: UseMonthPollingOptions) {
  const refreshed = useEffectEvent(onRefreshed);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restartKey only restarts the polling window
  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    let stopped = false;
    let timer: number | undefined;

    const tick = async (): Promise<void> => {
      const before = store.get(month);
      if (before?.status !== 'ready') return;
      await store.refresh(month, list);
      const after = store.get(month);
      if (after?.status !== 'ready') return;
      // Report even if the loop was just stopped: the refresh that settles the last pending
      // receipt re-renders with nothing pending, which runs this effect's cleanup before we get here.
      refreshed(month, before.items, after.items);
      if (!stopped && shouldKeepPolling(after.items, startedAt, Date.now())) {
        timer = window.setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [store, month, list, enabled, restartKey]);
}
