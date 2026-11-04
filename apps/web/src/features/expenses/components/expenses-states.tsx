'use client';

import { AlertIcon, PlusIcon, RefreshIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';

export const EMPTY_STATE_TITLE_ID = 'expenses-empty-title';

function Bone({ className }: { className?: string }) {
  // Pulse is decorative; reduced motion keeps a still placeholder instead of a 1ms flicker.
  return <div className={cn('animate-pulse rounded-xs bg-surface-muted motion-reduce:animate-none', className)} />;
}

/** Mirrors the loaded layout (summary card + list) so nothing jumps when data arrives. */
export function ExpensesSkeleton() {
  const { t } = useI18n();

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <p role="status" className="sr-only">
        {t.expenses.loading}
      </p>
      <div aria-hidden="true" className="rounded-lg bg-surface shadow-md">
        <div className="flex h-14 items-center justify-between border-b border-line pr-3 pl-5 sm:pl-6">
          <Bone className="h-5 w-36" />
          <div className="flex gap-2">
            <Bone className="size-8 rounded-sm" />
            <Bone className="size-8 rounded-sm" />
          </div>
        </div>
        <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
          <div className="flex flex-col gap-2.5">
            <Bone className="h-4 w-24" />
            <Bone className="h-10 w-48" />
            <Bone className="h-4 w-20" />
          </div>
          <div className="flex flex-col gap-4">
            <Bone className="h-4 w-28" />
            {['w-full', 'w-3/4', 'w-1/2'].map((width) => (
              <div key={width} className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Bone className="h-4 w-24" />
                  <Bone className="h-4 w-16" />
                </div>
                <Bone className={cn('h-1.5 rounded-full', width)} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex justify-between px-1">
          <Bone className="h-5 w-24" />
          <Bone className="h-4 w-16" />
        </div>
        <div className="divide-y divide-line rounded-lg bg-surface shadow-md">
          {['w-40', 'w-28', 'w-36', 'w-32'].map((width) => (
            <div key={width} className="flex items-center gap-4 px-4 py-4 md:px-6">
              <Bone className="hidden h-4 w-20 md:block" />
              <Bone className={cn('h-4', width)} />
              <Bone className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface ExpensesEmptyStateProps {
  onAdd: () => void;
}

/** First run: teach what the screen will show, then offer the one action that fills it. */
export function ExpensesEmptyState({ onAdd }: ExpensesEmptyStateProps) {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby={EMPTY_STATE_TITLE_ID}
      className="flex animate-reveal flex-col items-center rounded-xl border border-dashed border-line-strong/60 px-6 py-14 text-center sm:py-16"
    >
      {/* A blank receipt in the brand's torn-paper shape. */}
      <div aria-hidden="true" className="receipt-shadow">
        <div className="receipt-edge flex w-24 flex-col gap-2 rounded-t-md bg-surface px-3.5 pt-4 pb-6">
          <div className="h-1.5 w-3/5 rounded-full bg-primary-soft" />
          <div className="h-1.5 w-full rounded-full bg-surface-muted" />
          <div className="h-1.5 w-4/5 rounded-full bg-surface-muted" />
          <div className="mt-1 h-1.5 w-2/5 self-end rounded-full bg-line" />
        </div>
      </div>
      <h2
        id={EMPTY_STATE_TITLE_ID}
        tabIndex={-1}
        className="mt-6 rounded-xs text-lg font-semibold tracking-tight text-ink focus-visible:outline-offset-4"
      >
        {t.expenses.empty.title}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t.expenses.empty.description}</p>
      <Button onClick={onAdd} className="mt-6 pl-3.5">
        <PlusIcon />
        {t.expenses.addExpense}
      </Button>
    </section>
  );
}

export interface ExpensesLoadErrorProps {
  onRetry: () => void;
}

export function ExpensesLoadError({ onRetry }: ExpensesLoadErrorProps) {
  const { t } = useI18n();

  return (
    <section
      role="alert"
      className="flex animate-reveal flex-col items-start gap-4 rounded-lg bg-surface px-5 py-6 shadow-md sm:flex-row sm:px-6"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-danger-soft text-danger">
        <AlertIcon />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="font-semibold text-ink">{t.expenses.loadError.title}</h2>
        <p className="text-sm text-ink-muted">{t.expenses.loadError.description}</p>
      </div>
      <Button variant="secondary" onClick={onRetry} className="pl-3.5">
        <RefreshIcon />
        {t.expenses.loadError.retry}
      </Button>
    </section>
  );
}
