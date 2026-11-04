'use client';

import type { CreateExpenseInput, Expense, UpdateExpenseInput } from '@receipts-app/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toast } from '@/components/ui/toast';
import type { Dictionary } from '@/i18n/dictionaries';
import { useI18n } from '@/i18n/i18n-provider';
import { isApiStatus } from '../errors';
import { formatMonth } from '../format';
import { currentMonthKey, expensesInMonth, monthBounds, monthKeyOf, shiftMonth, summarizeMonth } from '../month';
import { changedFields } from '../schemas';
import { DeleteExpenseDialog } from './delete-expense-dialog';
import { ExpenseFormDialog, type ExpenseFormTarget } from './expense-form-dialog';
import { EXPENSE_LIST_TITLE_ID, ExpenseList } from './expense-list';
import { ADD_EXPENSE_BUTTON_ID, ExpensesHeader } from './expenses-header';
import { EMPTY_STATE_TITLE_ID, ExpensesEmptyState, ExpensesLoadError, ExpensesSkeleton } from './expenses-states';
import { MonthlySummary } from './monthly-summary';

/** The data operations the screen needs; injected so the screen never imports the network layer itself. */
export interface ExpensesApi {
  list: () => Promise<Expense[]>;
  create: (input: CreateExpenseInput) => Promise<Expense>;
  update: (id: string, input: UpdateExpenseInput) => Promise<Expense>;
  remove: (id: string) => Promise<void>;
}

export interface ExpensesWorkspaceProps {
  email: string;
  signingOut: boolean;
  onSignOut: () => void;
  api: ExpensesApi;
  /** Called when the API says the session is gone (401 on load). */
  onUnauthorized: () => void;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: Expense[] };
type ToastKey = keyof Dictionary['expenses']['toast'];

const TOAST_VISIBLE_MS = 3200;

/** Where focus goes when a dialog closes and the control that opened it is gone (e.g. its row was deleted). */
function fallbackFocus(): HTMLElement | null {
  return (
    document.getElementById(EXPENSE_LIST_TITLE_ID) ??
    document.getElementById(EMPTY_STATE_TITLE_ID) ??
    document.getElementById(ADD_EXPENSE_BUTTON_ID)
  );
}

export function ExpensesWorkspace({ email, signingOut, onSignOut, api, onUnauthorized }: ExpensesWorkspaceProps) {
  const { t, intlLocale } = useI18n();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState(currentMonthKey);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<ExpenseFormTarget>({ mode: 'create' });
  const [formSession, setFormSession] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const [toast, setToast] = useState<{ key: ToastKey; id: number } | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger; bumping it reloads the list
  useEffect(() => {
    let active = true;
    api
      .list()
      .then((items) => {
        if (active) setLoad({ status: 'ready', items });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isApiStatus(error, 401)) {
          onUnauthorized();
          return;
        }
        setLoad({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [api, attempt, onUnauthorized]);

  // Auto-hide; a newer toast restarts the clock.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToastOpen(false), TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((key: ToastKey) => {
    setToast((current) => ({ key, id: (current?.id ?? 0) + 1 }));
    setToastOpen(true);
  }, []);

  const items = load.status === 'ready' ? load.items : null;
  const thisMonth = currentMonthKey();
  const bounds = useMemo(() => monthBounds(items ?? [], thisMonth), [items, thisMonth]);
  const monthItems = useMemo(() => expensesInMonth(items ?? [], month), [items, month]);
  const summary = useMemo(() => summarizeMonth(monthItems), [monthItems]);
  const monthLabel = formatMonth(month, intlLocale);

  function updateItems(change: (current: Expense[]) => Expense[]): void {
    setLoad((current) => (current.status === 'ready' ? { status: 'ready', items: change(current.items) } : current));
  }

  function openCreate(): void {
    setFormTarget({ mode: 'create' });
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }

  function openEdit(expense: Expense): void {
    setFormTarget({ mode: 'edit', expense });
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }

  function openDelete(expense: Expense): void {
    setDeleteTarget(expense);
    setDeleteOpen(true);
  }

  /** Puts the saved expense in the list and follows it to its month, so the user sees the result. */
  function applySaved(saved: Expense, toastKey: ToastKey): void {
    updateItems((current) => [saved, ...current.filter((expense) => expense.id !== saved.id)]);
    setMonth(monthKeyOf(saved.date));
    setHighlightId(saved.id);
    setFormOpen(false);
    showToast(toastKey);
  }

  async function handleSave(input: CreateExpenseInput): Promise<void> {
    if (formTarget.mode === 'create') {
      applySaved(await api.create(input), 'added');
      return;
    }

    const { expense } = formTarget;
    const changes = changedFields(expense, input);
    if (Object.keys(changes).length === 0) {
      setFormOpen(false);
      return;
    }

    try {
      applySaved(await api.update(expense.id, changes), 'updated');
    } catch (error: unknown) {
      // Deleted elsewhere: drop the stale row; the dialog explains what happened.
      if (isApiStatus(error, 404)) {
        updateItems((current) => current.filter((item) => item.id !== expense.id));
      }
      throw error;
    }
  }

  async function handleDelete(expense: Expense): Promise<void> {
    try {
      await api.remove(expense.id);
    } catch (error: unknown) {
      // Already gone is the outcome the user asked for.
      if (!isApiStatus(error, 404)) throw error;
    }
    updateItems((current) => current.filter((item) => item.id !== expense.id));
    setDeleteOpen(false);
    showToast('deleted');
  }

  function retry(): void {
    setLoad({ status: 'loading' });
    setAttempt((count) => count + 1);
  }

  const clearHighlight = useCallback(() => setHighlightId(null), []);

  return (
    <section aria-labelledby="expenses-title" className="flex flex-col gap-8">
      <div className="animate-rise">
        <ExpensesHeader
          email={email}
          signingOut={signingOut}
          onSignOut={onSignOut}
          onAdd={openCreate}
          canAdd={items !== null}
        />
      </div>

      {/* One staggered entrance for the content block; later state swaps use a quiet reveal instead. */}
      <div className="stagger-1 animate-rise">
        {load.status === 'loading' ? <ExpensesSkeleton /> : null}
        {load.status === 'error' ? <ExpensesLoadError onRetry={retry} /> : null}
        {items && items.length === 0 ? <ExpensesEmptyState onAdd={openCreate} /> : null}
        {items && items.length > 0 ? (
          <div className="flex animate-reveal flex-col gap-8">
            <MonthlySummary
              monthLabel={monthLabel}
              summary={summary}
              canGoBack={month > bounds.min}
              canGoForward={month < bounds.max}
              onPrevious={() => setMonth((key) => shiftMonth(key, -1))}
              onNext={() => setMonth((key) => shiftMonth(key, 1))}
            />
            <ExpenseList
              monthLabel={monthLabel}
              expenses={monthItems}
              highlightId={highlightId}
              onHighlightEnd={clearHighlight}
              onEdit={openEdit}
              onDelete={openDelete}
            />
          </div>
        ) : null}
      </div>

      <ExpenseFormDialog
        open={formOpen}
        target={formTarget}
        session={formSession}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        fallbackFocus={fallbackFocus}
      />
      <DeleteExpenseDialog
        open={deleteOpen}
        expense={deleteTarget}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        fallbackFocus={fallbackFocus}
      />
      <Toast message={toast ? t.expenses.toast[toast.key] : null} messageId={toast?.id} open={toastOpen} />
    </section>
  );
}
