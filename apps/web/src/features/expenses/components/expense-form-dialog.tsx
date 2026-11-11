'use client';

import type { CreateExpenseInput, ProcessedExpense } from '@receipts-app/contracts';
import { type SubmitEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/input';
import { useI18n } from '@/i18n/i18n-provider';
import { type ExpenseErrorKey, getExpenseErrorKey } from '../errors';
import { todayIsoDate } from '../month';
import { DEFAULT_CURRENCY, type ExpenseFieldErrors, parseExpenseForm } from '../schemas';
import { ExpenseFields, type ExpenseFormValues, focusFirstInvalid } from './expense-fields';

/** Only a PROCESSED expense has the fields the form edits; an unprocessed receipt can only be deleted. */
export type ExpenseFormTarget = { mode: 'create' } | { mode: 'edit'; expense: ProcessedExpense };

export interface ExpenseFormDialogProps {
  open: boolean;
  /** What the dialog edits. Kept while closing so the exit animation shows the same content. */
  target: ExpenseFormTarget;
  /** Changes on every open, so the form starts from fresh values and no stale errors. */
  session: number;
  onClose: () => void;
  /** Persists the validated input; throws an ApiError (or anything) on failure. */
  onSave: (input: CreateExpenseInput) => Promise<void>;
  fallbackFocus: () => HTMLElement | null;
}

export function ExpenseFormDialog({ open, target, session, onClose, onSave, fallbackFocus }: ExpenseFormDialogProps) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const editing = target.mode === 'edit';
  const { form } = t.expenses;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? form.editTitle : form.addTitle}
      description={editing ? form.editDescription : form.addDescription}
      dismissible={!saving}
      closeLabel={form.close}
      fallbackFocus={fallbackFocus}
    >
      <ExpenseForm
        key={session}
        expense={editing ? target.expense : null}
        saving={saving}
        setSaving={setSaving}
        onCancel={onClose}
        onSave={onSave}
      />
    </Dialog>
  );
}

interface ExpenseFormProps {
  expense: ProcessedExpense | null;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
  onSave: (input: CreateExpenseInput) => Promise<void>;
}

function ExpenseForm({ expense, saving, setSaving, onCancel, onSave }: ExpenseFormProps) {
  const { t } = useI18n();
  const id = useId();
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [formError, setFormError] = useState<ExpenseErrorKey | null>(null);
  const { form } = t.expenses;
  const defaults: ExpenseFormValues = expense ?? {
    merchant: '',
    total: null,
    currency: DEFAULT_CURRENCY,
    date: todayIsoDate(),
    category: 'groceries',
  };

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setFormError(null);

    const parsed = parseExpenseForm(new FormData(formElement));
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      focusFirstInvalid(formElement, id, parsed.errors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      await onSave(parsed.data);
    } catch (error: unknown) {
      setFormError(getExpenseErrorKey(error, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogBody>
        {/* A disabled fieldset locks every control while the request is in flight. */}
        <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
          <ExpenseFields idPrefix={id} defaults={defaults} errors={fieldErrors} />
        </fieldset>
        {formError ? (
          <FieldError role="alert" className="mt-4">
            {t.expenses.apiErrors[formError]}
          </FieldError>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {form.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? form.saving : expense ? form.submitEdit : form.submitAdd}
        </Button>
      </DialogFooter>
    </form>
  );
}
