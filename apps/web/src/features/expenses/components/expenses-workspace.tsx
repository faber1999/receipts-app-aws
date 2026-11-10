'use client';

import type {
  CreateExpenseInput,
  Expense,
  ProcessedExpense,
  UnprocessedExpense,
  UpdateExpenseInput,
} from '@receipts-app/contracts';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Toast } from '@/components/ui/toast';
import { ReceiptPhotoDialog } from '@/features/receipts/components/receipt-photo-dialog';
import { UploadReceiptDialog } from '@/features/receipts/components/upload-receipt-dialog';
import type { ReceiptPhotoLoader } from '@/features/receipts/photo-url';
import type { Dictionary } from '@/i18n/dictionaries';
import { useI18n } from '@/i18n/i18n-provider';
import { moneyDisplayFor } from '@/lib/money';
import { isApiStatus } from '../errors';
import { formatMonth } from '../format';
import { currentMonthKey, type MonthKey, monthKeyOf, shiftMonth, summarizeMonth } from '../month';
import { MonthExpensesStore } from '../month-store';
import { hasPendingReceipt, settleReceipts } from '../polling';
import { changedFields } from '../schemas';
import { isProcessed } from '../status';
import { useMonthPolling } from '../use-month-polling';
import { DeleteExpenseDialog } from './delete-expense-dialog';
import { ExpenseFormDialog, type ExpenseFormTarget } from './expense-form-dialog';
import { EXPENSE_LIST_TITLE_ID, ExpenseList } from './expense-list';
import { ADD_EXPENSE_BUTTON_ID, ExpensesHeader, UPLOAD_RECEIPT_BUTTON_ID } from './expenses-header';
import { EMPTY_STATE_TITLE_ID, ExpensesEmptyState, ExpensesLoadError, ExpensesSkeleton } from './expenses-states';
import { MONTH_TITLE_ID, MonthSwitcher } from './month-switcher';
import { MonthlySummary } from './monthly-summary';

/** The data operations the screen needs; injected so the screen never imports the network layer itself. */
export interface ExpensesApi {
  /** One calendar month (YYYY-MM), newest first. */
  list: (month: MonthKey) => Promise<Expense[]>;
  create: (input: CreateExpenseInput) => Promise<Expense>;
  update: (id: string, input: UpdateExpenseInput) => Promise<Expense>;
  remove: (id: string) => Promise<void>;
  /** Uploads a prepared receipt photo; resolves with its PENDING expense once the photo is stored. */
  uploadReceipt: (image: Blob) => Promise<UnprocessedExpense>;
  /** A short-lived URL for an expense's receipt photo. */
  receiptPhoto: ReceiptPhotoLoader;
}

export interface ExpensesWorkspaceProps {
  api: ExpensesApi;
  /** Called when the API says the session is gone (401 on a month load). */
  onUnauthorized: () => void;
}

type ToastKey = keyof Dictionary['expenses']['toast'];

const TOAST_VISIBLE_MS = 3200;

/** Where focus goes when a dialog closes and the control that opened it is gone (e.g. its row was deleted). */
function fallbackFocus(): HTMLElement | null {
  return (
    document.getElementById(EXPENSE_LIST_TITLE_ID) ??
    document.getElementById(EMPTY_STATE_TITLE_ID) ??
    document.getElementById(MONTH_TITLE_ID) ??
    document.getElementById(UPLOAD_RECEIPT_BUTTON_ID) ??
    document.getElementById(ADD_EXPENSE_BUTTON_ID)
  );
}

export function ExpensesWorkspace({ api, onUnauthorized }: ExpensesWorkspaceProps) {
  const { t, intlLocale } = useI18n();
  const [store] = useState(() => new MonthExpensesStore());
  const [month, setMonth] = useState(currentMonthKey);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<ExpenseFormTarget>({ mode: 'create' });
  const [formSession, setFormSession] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSession, setUploadSession] = useState(0);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<Expense | null>(null);
  const [photoSession, setPhotoSession] = useState(0);
  // Bumped per upload so polling restarts its window; deleted ids never count as "moved".
  const [uploadCount, setUploadCount] = useState(0);
  const deletedIds = useRef(new Set<string>());

  const [toast, setToast] = useState<{ key: ToastKey; id: number } | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const entry = useSyncExternalStore(
    store.subscribe,
    () => store.get(month),
    () => undefined,
  );

  // Each month is fetched the first time it is shown; after that it renders from the cache.
  useEffect(() => {
    store.ensure(month, api.list);
  }, [store, month, api]);

  useEffect(() => {
    if (entry?.status === 'error' && entry.unauthorized) onUnauthorized();
  }, [entry, onUnauthorized]);

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

  const items = entry?.status === 'ready' ? entry.items : null;

  // While receipts in this month are being read, refetch it until they settle (or polling gives up).
  useMonthPolling({
    store,
    month,
    list: api.list,
    enabled: hasPendingReceipt(items),
    restartKey: uploadCount,
    onRefreshed: (refreshedMonth, before, after) => {
      const { read, moved } = settleReceipts(before, after);
      // The row now shows what the AI read; point the eye at it.
      const first = read[0];
      if (first) setHighlightId(first);
      if (moved.some((id) => !deletedIds.current.has(id))) {
        // Its receipt date put it in a month we cannot name: refetch any other month when it is next shown.
        store.invalidateExcept(refreshedMonth);
        showToast('receiptFiled');
      }
    },
  });

  const loading = entry === undefined || entry.status === 'loading';
  const thisMonth = currentMonthKey();
  const summary = useMemo(() => summarizeMonth(items ?? []), [items]);
  // One display for every row of the month (and its delete dialog), so amounts compare at a glance.
  // Unprocessed receipts have no currency yet, so only processed ones decide it.
  const moneyDisplay = useMemo(
    () => moneyDisplayFor((items ?? []).filter(isProcessed).map((expense) => expense.currency)),
    [items],
  );
  const monthLabel = formatMonth(month, intlLocale);
  // Follow the row while the viewer is open: a receipt read meanwhile gets its merchant in the title.
  const photoExpense = (photoTarget && items?.find((expense) => expense.id === photoTarget.id)) ?? photoTarget;

  function openCreate(): void {
    setFormTarget({ mode: 'create' });
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }

  function openEdit(expense: ProcessedExpense): void {
    setFormTarget({ mode: 'edit', expense });
    setFormSession((session) => session + 1);
    setFormOpen(true);
  }

  function openUpload(): void {
    setUploadSession((session) => session + 1);
    setUploadOpen(true);
  }

  /** The photo is stored: show its PENDING row in its month (today's) right away; polling takes it from there. */
  async function handleUpload(image: Blob): Promise<void> {
    const expense = await api.uploadReceipt(image);
    const target = monthKeyOf(expense.date);
    store.apply({ type: 'upsert', expense }, target);
    setMonth(target);
    setHighlightId(expense.id);
    setUploadCount((count) => count + 1);
    setUploadOpen(false);
    showToast('receiptUploaded');
  }

  function openPhoto(expense: Expense): void {
    setPhotoTarget(expense);
    setPhotoSession((session) => session + 1);
    setPhotoOpen(true);
  }

  function openDelete(expense: Expense): void {
    setDeleteTarget(expense);
    setDeleteOpen(true);
  }

  /** Puts the saved expense in its month (out of any other) and follows it there, so the user sees the result. */
  function applySaved(saved: Expense, toastKey: ToastKey): void {
    const target = monthKeyOf(saved.date);
    store.apply({ type: 'upsert', expense: saved }, target);
    setMonth(target);
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
        store.apply({ type: 'remove', id: expense.id });
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
    deletedIds.current.add(expense.id);
    store.apply({ type: 'remove', id: expense.id });
    setDeleteOpen(false);
    showToast(isProcessed(expense) ? 'deleted' : 'receiptDeleted');
  }

  function retry(): void {
    store.load(month, api.list);
  }

  function goToMonth(delta: number): void {
    setMonth((key) => {
      const next = shiftMonth(key, delta);
      // Never into the future (a saved future-dated expense can still be opened directly).
      return delta > 0 && next > currentMonthKey() ? key : next;
    });
  }

  const clearHighlight = useCallback(() => setHighlightId(null), []);

  return (
    <section aria-labelledby="expenses-title" className="flex flex-col gap-8">
      <div className="animate-rise">
        <ExpensesHeader onAdd={openCreate} onUpload={openUpload} />
      </div>

      {/* One staggered entrance for the month block; later state swaps use a quiet reveal instead. */}
      <div className="stagger-1 flex animate-rise flex-col gap-4">
        {/* Stays mounted across months and loads, so the controls never move and focus stays put. */}
        <MonthSwitcher
          monthLabel={monthLabel}
          canGoForward={month < thisMonth}
          onPrevious={() => goToMonth(-1)}
          onNext={() => goToMonth(1)}
        />

        <div aria-busy={loading}>
          {loading ? <ExpensesSkeleton monthLabel={monthLabel} /> : null}
          {entry?.status === 'error' ? <ExpensesLoadError monthLabel={monthLabel} onRetry={retry} /> : null}
          {items && items.length === 0 ? (
            <ExpensesEmptyState
              monthLabel={monthLabel}
              isCurrentMonth={month === thisMonth}
              onAdd={openCreate}
              onUpload={openUpload}
            />
          ) : null}
          {items && items.length > 0 ? (
            <div className="flex animate-reveal flex-col gap-8">
              <MonthlySummary summary={summary} />
              <ExpenseList
                monthLabel={monthLabel}
                expenses={items}
                moneyDisplay={moneyDisplay}
                highlightId={highlightId}
                onHighlightEnd={clearHighlight}
                onEdit={openEdit}
                onDelete={openDelete}
                onViewReceipt={openPhoto}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ExpenseFormDialog
        open={formOpen}
        target={formTarget}
        session={formSession}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        fallbackFocus={fallbackFocus}
      />
      <UploadReceiptDialog
        open={uploadOpen}
        session={uploadSession}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        fallbackFocus={fallbackFocus}
      />
      <ReceiptPhotoDialog
        open={photoOpen}
        session={photoSession}
        expense={photoExpense}
        onClose={() => setPhotoOpen(false)}
        loadPhoto={api.receiptPhoto}
        fallbackFocus={fallbackFocus}
      />
      <DeleteExpenseDialog
        open={deleteOpen}
        expense={deleteTarget}
        moneyDisplay={moneyDisplay}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        fallbackFocus={fallbackFocus}
      />
      <Toast message={toast ? t.expenses.toast[toast.key] : null} messageId={toast?.id} open={toastOpen} />
    </section>
  );
}
