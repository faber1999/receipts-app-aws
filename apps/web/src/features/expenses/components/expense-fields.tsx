'use client';

import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@receipts-app/contracts';
import { type ReactNode, useState } from 'react';
import { TextField } from '@/components/ui/input';
import { MoneyField } from '@/components/ui/money-input';
import { SelectField } from '@/components/ui/select';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import {
  DEFAULT_CURRENCY,
  EXPENSE_FIELDS,
  type ExpenseField,
  type ExpenseFieldErrors,
  FORM_CURRENCIES,
} from '../schemas';

/** Where the form starts. '' (or null for the total) leaves a field empty, e.g. one the AI could not read. */
export interface ExpenseFormValues {
  merchant: string;
  total: number | null;
  currency: string;
  date: string;
  category: ExpenseCategory | '';
}

/** A note under a field that asks the person to look at it, until they change it. */
export type ExpenseFieldNotes = Partial<Record<ExpenseField, string>>;

export interface ExpenseFieldsProps {
  /** Prefix for the control ids (see expenseFieldId), e.g. from useId(). */
  idPrefix: string;
  defaults: ExpenseFormValues;
  errors: ExpenseFieldErrors;
  /** Attention notes (e.g. "Not read, please fill in"); an error on the same field replaces its note. */
  notes?: ExpenseFieldNotes;
  /** Placeholder option for an empty currency or category select (required when a default is ''). */
  placeholders?: { currency: string; category: string };
  /** One field per row for date and category (e.g. in a column beside a photo), so their notes fit. */
  stacked?: boolean;
}

export function expenseFieldId(idPrefix: string, field: ExpenseField): string {
  return `${idPrefix}-${field}`;
}

/**
 * Moves focus to the first invalid field, so keyboard and screen reader users land on the problem.
 * By id, not name: the total's `name` sits on a hidden input that carries the plain number.
 */
export function focusFirstInvalid(form: HTMLFormElement, idPrefix: string, errors: ExpenseFieldErrors): void {
  const first = EXPENSE_FIELDS.find((field) => errors[field]);
  const control = first ? form.ownerDocument.getElementById(expenseFieldId(idPrefix, first)) : null;
  if (control instanceof HTMLElement) control.focus();
}

/**
 * The five expense controls (merchant, total + currency, date, category), uncontrolled so the
 * parent reads them with FormData and validates with parseExpenseForm. Shared by the add/edit
 * form and the review dialog.
 */
export function ExpenseFields({
  idPrefix,
  defaults,
  errors,
  notes = {},
  placeholders,
  stacked = false,
}: ExpenseFieldsProps) {
  const { t } = useI18n();
  const { form } = t.expenses;
  // Mirrors the (still uncontrolled) currency select so the total can format for it.
  const [currency, setCurrency] = useState(defaults.currency);
  // A note is for the value the form started with; once the person changes the field it has done its job.
  const [changed, setChanged] = useState<ReadonlySet<ExpenseField>>(() => new Set());

  function markChanged(field: ExpenseField): void {
    if (notes[field] && !changed.has(field)) setChanged(new Set(changed).add(field));
  }

  // Keep a currency the form does not offer (e.g. one read from a receipt) instead of silently changing it.
  const currencies: string[] =
    defaults.currency && !(FORM_CURRENCIES as readonly string[]).includes(defaults.currency)
      ? [...FORM_CURRENCIES, defaults.currency]
      : [...FORM_CURRENCIES];

  const id = (field: ExpenseField) => expenseFieldId(idPrefix, field);
  const errorText = (field: ExpenseField) => {
    const key = errors[field];
    return key ? t.validation[key] : undefined;
  };
  const note = (field: ExpenseField): ReactNode => {
    const text = notes[field];
    return text && !errors[field] && !changed.has(field) ? <FieldNote>{text}</FieldNote> : undefined;
  };
  // Flagged fields get a warning ring until changed; an error's danger ring wins (aria-invalid comes later).
  const flagged = (field: ExpenseField) => (note(field) ? 'ring-warning hover:ring-warning' : undefined);
  // The currency column is too narrow for a note, so the amount row carries both notes on one line below it.
  const totalNote = note('total');
  const currencyNote = note('currency');
  const noteId = (field: ExpenseField) => `${id(field)}-note`;

  return (
    <>
      <TextField
        id={id('merchant')}
        name="merchant"
        label={form.merchantLabel}
        placeholder={form.merchantPlaceholder}
        defaultValue={defaults.merchant}
        autoComplete="off"
        maxLength={120}
        onChange={() => markChanged('merchant')}
        hint={note('merchant')}
        inputClassName={flagged('merchant')}
        error={errorText('merchant')}
      />
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <MoneyField
            id={id('total')}
            name="total"
            // An unread currency still needs a format to type in; the select stays empty until chosen.
            currency={currency || DEFAULT_CURRENCY}
            label={form.totalLabel}
            currencyDescription={currency ? form.totalCurrency : undefined}
            defaultValue={defaults.total}
            onValueChange={() => markChanged('total')}
            aria-describedby={totalNote ? noteId('total') : undefined}
            inputClassName={flagged('total')}
            error={errorText('total')}
          />
          <SelectField
            id={id('currency')}
            name="currency"
            label={form.currencyLabel}
            defaultValue={defaults.currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              markChanged('currency');
            }}
            aria-describedby={currencyNote ? noteId('currency') : undefined}
            selectClassName={cn(flagged('currency'), !currency && 'text-ink-subtle')}
            error={errorText('currency')}
          >
            {defaults.currency === '' && placeholders ? (
              <option value="" disabled>
                {placeholders.currency}
              </option>
            ) : null}
            {currencies.map((code) => (
              <option key={code} value={code} className="text-ink">
                {code}
              </option>
            ))}
          </SelectField>
        </div>
        {totalNote || currencyNote ? (
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
            {totalNote ? <p id={noteId('total')}>{totalNote}</p> : null}
            {currencyNote ? (
              <p id={noteId('currency')} className="ml-auto">
                {currencyNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={cn('grid gap-4', !stacked && 'sm:grid-cols-2 sm:gap-3')}>
        <TextField
          id={id('date')}
          name="date"
          type="date"
          label={form.dateLabel}
          defaultValue={defaults.date}
          onChange={() => markChanged('date')}
          hint={note('date')}
          inputClassName={cn('tabular-nums', flagged('date'))}
          error={errorText('date')}
        />
        <CategorySelect
          id={id('category')}
          defaultValue={defaults.category}
          placeholder={placeholders?.category}
          onChange={() => markChanged('category')}
          hint={note('category')}
          className={flagged('category')}
          error={errorText('category')}
        />
      </div>
    </>
  );
}

interface CategorySelectProps {
  id: string;
  defaultValue: ExpenseCategory | '';
  placeholder: string | undefined;
  onChange: () => void;
  hint: ReactNode;
  className: string | undefined;
  error: string | undefined;
}

function CategorySelect({ id, defaultValue, placeholder, onChange, hint, className, error }: CategorySelectProps) {
  const { t } = useI18n();
  const [empty, setEmpty] = useState(defaultValue === '');

  return (
    <SelectField
      id={id}
      name="category"
      label={t.expenses.form.categoryLabel}
      defaultValue={defaultValue}
      onChange={(event) => {
        setEmpty(event.target.value === '');
        onChange();
      }}
      hint={hint}
      selectClassName={cn(className, empty && 'text-ink-subtle')}
      error={error}
    >
      {defaultValue === '' && placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {EXPENSE_CATEGORIES.map((category) => (
        <option key={category} value={category} className="text-ink">
          {t.categories[category]}
        </option>
      ))}
    </SelectField>
  );
}

/** Warning ink with a dot, so the note reads as "look here" without relying on color alone. */
function FieldNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-warning">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
