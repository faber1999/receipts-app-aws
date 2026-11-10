import type { Expense, ProcessedExpense, UnprocessedExpense } from '@receipts-app/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { MonthKey } from './month';
import { LAG_GRACE_MS, type ListMonth, MonthExpensesStore } from './month-store';

// api-client reads the Amplify/API env at import; the store only needs ApiError, so stub the env.
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_USER_POOL_ID: 'us-east-2_test',
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: 'test-client',
    NEXT_PUBLIC_API_URL: 'https://api.example.test',
  },
}));

function expense(id: string, date: string): ProcessedExpense {
  return {
    id,
    status: 'PROCESSED',
    merchant: 'Café Aroma',
    total: 12000,
    currency: 'COP',
    date,
    category: 'restaurants',
    createdAt: `${date}T15:00:00.000Z`,
  };
}

const A = expense('00000000-0000-4000-8000-00000000000a', '2026-11-03');
const B = expense('00000000-0000-4000-8000-00000000000b', '2026-11-10');
const OCT = expense('00000000-0000-4000-8000-00000000000c', '2026-10-20');

const PENDING: UnprocessedExpense = {
  id: '00000000-0000-4000-8000-00000000000d',
  status: 'PENDING',
  date: '2026-11-08',
  imageKey: 'receipts/d.jpg',
  createdAt: '2026-11-08T15:00:00.000Z',
};

interface Deferred {
  month: MonthKey;
  resolve: (items: Expense[]) => void;
  reject: (error: unknown) => void;
}

/** A ListMonth whose requests resolve only when the test says so, to control arrival order. */
function controlledList(): { list: ListMonth; calls: Deferred[] } {
  const calls: Deferred[] = [];
  const list: ListMonth = (month) =>
    new Promise((resolve, reject) => {
      calls.push({ month, resolve, reject });
    });
  return { list, calls };
}

function call(calls: Deferred[], index: number): Deferred {
  const found = calls[index];
  if (!found) throw new Error(`No request #${index}`);
  return found;
}

/** Lets the store's promise handlers run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('MonthExpensesStore', () => {
  it('fetches a month once and serves it from memory afterwards', async () => {
    const store = new MonthExpensesStore();
    const list = vi.fn<ListMonth>(async () => [A]);
    store.ensure('2026-11', list);
    expect(store.get('2026-11')).toEqual({ status: 'loading' });
    await flush();
    store.ensure('2026-11', list);
    expect(list).toHaveBeenCalledTimes(1);
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [A] });
  });

  it('ignores a superseded response for the same month', async () => {
    const store = new MonthExpensesStore();
    const { list, calls } = controlledList();
    store.load('2026-11', list);
    store.load('2026-11', list);
    call(calls, 1).resolve([B]);
    await flush();
    call(calls, 0).resolve([A]);
    await flush();
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [B] });
  });

  it('files a late response under its own month', async () => {
    const store = new MonthExpensesStore();
    const { list, calls } = controlledList();
    store.load('2026-10', list);
    store.load('2026-11', list);
    call(calls, 1).resolve([A]);
    call(calls, 0).resolve([OCT]);
    await flush();
    expect(store.get('2026-10')).toEqual({ status: 'ready', items: [OCT] });
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [A] });
  });

  it('patches loaded months right away, including moving an expense between them', async () => {
    const store = new MonthExpensesStore();
    store.load('2026-10', async () => []);
    store.load('2026-11', async () => [A]);
    await flush();
    const moved = { ...A, date: '2026-10-15' };
    store.apply({ type: 'upsert', expense: moved });
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [] });
    expect(store.get('2026-10')).toEqual({ status: 'ready', items: [moved] });
  });

  it('replays a change queued while loading over a response that predates it', async () => {
    const store = new MonthExpensesStore();
    const { list, calls } = controlledList();
    store.load('2026-11', list);
    store.apply({ type: 'upsert', expense: B });
    store.apply({ type: 'remove', id: A.id });
    // The read lags behind the writes: it still has A and not B.
    call(calls, 0).resolve([A]);
    await flush();
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [B] });
  });

  it('queues a change for the target month before it is ever fetched', async () => {
    const store = new MonthExpensesStore();
    store.apply({ type: 'upsert', expense: OCT }, '2026-10');
    expect(store.get('2026-10')).toBeUndefined();
    store.ensure('2026-10', async () => []);
    await flush();
    expect(store.get('2026-10')).toEqual({ status: 'ready', items: [OCT] });
  });

  it('keeps queued changes through a failed load for the retry', async () => {
    const store = new MonthExpensesStore();
    const { list, calls } = controlledList();
    store.load('2026-11', list);
    store.apply({ type: 'upsert', expense: B });
    call(calls, 0).reject(new Error('network'));
    await flush();
    expect(store.get('2026-11')).toEqual({ status: 'error', unauthorized: false });

    store.load('2026-11', list);
    call(calls, 1).resolve([]);
    await flush();
    expect(store.get('2026-11')).toEqual({ status: 'ready', items: [B] });
  });

  it('marks a 401 failure as unauthorized', async () => {
    const store = new MonthExpensesStore();
    store.load('2026-11', async () => {
      throw new ApiError(401, 'Not signed in');
    });
    await flush();
    expect(store.get('2026-11')).toEqual({ status: 'error', unauthorized: true });
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const store = new MonthExpensesStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.load('2026-11', async () => [A]);
    await flush();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.apply({ type: 'remove', id: A.id });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  describe('refresh', () => {
    /** A store on a fake clock, with November loaded as `items`. */
    async function loaded(items: Expense[]) {
      let clock = 1_000_000;
      const store = new MonthExpensesStore(() => clock);
      store.load('2026-11', async () => items);
      await flush();
      return {
        store,
        advance: (ms: number) => {
          clock += ms;
        },
      };
    }

    it('keeps the month on screen while it refetches, then shows the new list', async () => {
      const { store } = await loaded([PENDING]);
      const { list, calls } = controlledList();
      const done = store.refresh('2026-11', list);
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [PENDING] });
      const read = expense(PENDING.id, '2026-11-08');
      call(calls, 0).resolve([read]);
      await done;
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [read] });
    });

    it('does nothing for a month that is not loaded', async () => {
      const store = new MonthExpensesStore();
      const list = vi.fn<ListMonth>(async () => []);
      await store.refresh('2026-11', list);
      expect(list).not.toHaveBeenCalled();
      expect(store.get('2026-11')).toBeUndefined();
    });

    it('keeps a just-uploaded receipt that a lagging read does not list yet', async () => {
      const { store, advance } = await loaded([A]);
      store.apply({ type: 'upsert', expense: PENDING }, '2026-11');
      advance(3000);
      await store.refresh('2026-11', async () => [A]);
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [PENDING, A] });
    });

    it('lets the receipt go once the grace period is over (it was filed in another month)', async () => {
      const { store, advance } = await loaded([A]);
      store.apply({ type: 'upsert', expense: PENDING }, '2026-11');
      advance(LAG_GRACE_MS + 1);
      await store.refresh('2026-11', async () => [A]);
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [A] });
    });

    it('never overwrites a server update with the older local copy', async () => {
      const { store, advance } = await loaded([]);
      store.apply({ type: 'upsert', expense: PENDING }, '2026-11');
      advance(1000);
      const read = expense(PENDING.id, '2026-11-08');
      await store.refresh('2026-11', async () => [read]);
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [read] });
    });

    it('replays a change made while the refresh was in flight', async () => {
      const { store, advance } = await loaded([A, B]);
      const { list, calls } = controlledList();
      const done = store.refresh('2026-11', list);
      advance(10);
      const edited = { ...A, merchant: 'Edited' };
      store.apply({ type: 'upsert', expense: edited });
      store.apply({ type: 'remove', id: B.id });
      call(calls, 0).resolve([A, B]);
      await done;
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [edited] });
    });

    it('keeps the last list on a failure, but reports a 401', async () => {
      const { store } = await loaded([A]);
      await store.refresh('2026-11', async () => {
        throw new Error('network');
      });
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [A] });
      await store.refresh('2026-11', async () => {
        throw new ApiError(401, 'Not signed in');
      });
      expect(store.get('2026-11')).toEqual({ status: 'error', unauthorized: true });
    });
  });

  describe('invalidateExcept', () => {
    it('forgets the other months so they are fetched again', async () => {
      const store = new MonthExpensesStore();
      store.load('2026-10', async () => [OCT]);
      store.load('2026-11', async () => [A]);
      await flush();
      store.invalidateExcept('2026-11');
      expect(store.get('2026-10')).toBeUndefined();
      expect(store.get('2026-11')).toEqual({ status: 'ready', items: [A] });

      const list = vi.fn<ListMonth>(async () => [OCT, expense(PENDING.id, '2026-10-30')]);
      store.ensure('2026-10', list);
      await flush();
      expect(list).toHaveBeenCalledTimes(1);
    });

    it('ignores a response that was already on its way for a forgotten month', async () => {
      const store = new MonthExpensesStore();
      const { list, calls } = controlledList();
      store.load('2026-10', list);
      store.invalidateExcept('2026-11');
      call(calls, 0).resolve([OCT]);
      await flush();
      expect(store.get('2026-10')).toBeUndefined();
    });
  });
});
