'use client';

import { type CreateExpenseInput, EXPENSE_CATEGORIES, type Expense } from '@receipts-app/contracts';
import { type SubmitEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { FieldError, TextField } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { useI18n } from '@/i18n/i18n-provider';
import { type ExpenseErrorKey, getExpenseErrorKey } from '../errors';
import { todayIsoDate } from '../month';
import {
  DEFAULT_CURRENCY,
  EXPENSE_FIELDS,
  type ExpenseFieldErrors,
  FORM_CURRENCIES,
  parseExpenseForm,
} from '../schemas';

export type ExpenseFormTarget = { mode: 'create' } | { mode: 'edit'; expense: Expense };

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
  expense: Expense | null;
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

  // Keep a currency the form does not offer (e.g. one read from a receipt) instead of silently changing it.
  const currencies: string[] =
    expense && !(FORM_CURRENCIES as readonly string[]).includes(expense.currency)
      ? [...FORM_CURRENCIES, expense.currency]
      : [...FORM_CURRENCIES];

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    setFormError(null);

    const parsed = parseExpenseForm(new FormData(formElement));
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      // Move focus to the first invalid field so keyboard and screen reader users land on the problem.
      const first = EXPENSE_FIELDS.find((field) => parsed.errors[field]);
      const control = first ? formElement.elements.namedItem(first) : null;
      if (control instanceof HTMLElement) control.focus();
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

  const fieldId = (name: string) => `${id}-${name}`;
  const errorText = (field: keyof ExpenseFieldErrors) => {
    const key = fieldErrors[field];
    return key ? t.validation[key] : undefined;
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DialogBody>
        {/* A disabled fieldset locks every control while the request is in flight. */}
        <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
          <TextField
            id={fieldId('merchant')}
            name="merchant"
            label={form.merchantLabel}
            placeholder={form.merchantPlaceholder}
            defaultValue={expense?.merchant ?? ''}
            autoComplete="off"
            maxLength={120}
            error={errorText('merchant')}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <TextField
              id={fieldId('total')}
              name="total"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              label={form.totalLabel}
              placeholder="0"
              defaultValue={expense ? String(expense.total) : ''}
              inputClassName="tabular-nums"
              error={errorText('total')}
            />
            <SelectField
              id={fieldId('currency')}
              name="currency"
              label={form.currencyLabel}
              defaultValue={expense?.currency ?? DEFAULT_CURRENCY}
              error={errorText('currency')}
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
            <TextField
              id={fieldId('date')}
              name="date"
              type="date"
              label={form.dateLabel}
              defaultValue={expense?.date ?? todayIsoDate()}
              inputClassName="tabular-nums"
              error={errorText('date')}
            />
            <SelectField
              id={fieldId('category')}
              name="category"
              label={form.categoryLabel}
              defaultValue={expense?.category ?? 'groceries'}
              error={errorText('category')}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t.categories[category]}
                </option>
              ))}
            </SelectField>
          </div>
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
