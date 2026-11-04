'use client';

import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useI18n } from '@/i18n/i18n-provider';
import { cn } from '@/lib/cn';
import { currencyAffix, currencyFractionDigits, numberSeparators } from '@/lib/money';
import {
  type BuildResult,
  buildDraft,
  type DraftEdit,
  displayToDraftChars,
  draftCaretToDisplay,
  draftToNumber,
  formatDraft,
  isOnlyGrouping,
  normalizePastedText,
  numberToDraft,
  roundDraft,
  settleDraft,
} from '@/lib/money-draft';
import { FieldError, FieldHint, fieldControlStyles, Label } from './input';

function inputTypeOf(event: ChangeEvent<HTMLInputElement>): string {
  return event.nativeEvent instanceof InputEvent ? event.nativeEvent.inputType : '';
}

export interface MoneyInputProps
  extends Omit<
    ComponentPropsWithoutRef<'input'>,
    'value' | 'defaultValue' | 'onChange' | 'onPaste' | 'type' | 'inputMode' | 'name' | 'children'
  > {
  /** ISO 4217 code. Decides the symbol, its side (per locale) and how many decimals are allowed. */
  currency: string;
  /** Controlled value, as a number (never the formatted text). */
  value?: number | null;
  /** Initial value for uncontrolled use. */
  defaultValue?: number | null;
  /** Called with the parsed amount whenever it changes, or null when the field is empty. */
  onValueChange?: (value: number | null) => void;
  /** Name for a hidden input carrying the plain number (e.g. "123123.5"), so FormData keeps working. */
  name?: string;
  /** Intl locale for separators; defaults to the current UI locale. */
  locale?: string;
  /** Marks the field as invalid (sets aria-invalid and the error style). */
  invalid?: boolean;
  /** Class for the wrapper that positions the currency adornment. */
  wrapperClassName?: string;
}

/**
 * Money amount field: text input with a decimal keypad, live thousands grouping in the UI
 * locale, decimals only where the currency has minor units, and the caret kept in place.
 * Exposes numbers, not strings.
 */
export function MoneyInput({
  currency,
  value,
  defaultValue,
  onValueChange,
  name,
  locale,
  invalid = false,
  className,
  wrapperClassName,
  onBlur,
  disabled,
  placeholder = '0',
  style,
  ...props
}: MoneyInputProps) {
  const { intlLocale } = useI18n();
  const activeLocale = locale ?? intlLocale;
  const separators = numberSeparators(activeLocale);
  const fractionDigits = currencyFractionDigits(currency, activeLocale);
  // Narrow symbol ("$", "€"): the currency select sits right beside the field and names it.
  const { symbol, position, spaced } = currencyAffix(currency, activeLocale, 'narrow');
  const controlled = value !== undefined;

  const [edit, setEdit] = useState<DraftEdit>(() => ({
    draft: numberToDraft(controlled ? value : defaultValue, fractionDigits),
    caret: null,
  }));
  const [seenValue, setSeenValue] = useState(value);
  const [seenCurrency, setSeenCurrency] = useState(currency);

  // A new controlled value from the parent replaces the draft, unless it is the number the draft
  // already holds (so "12." keeps its point while the parent echoes 12 back).
  if (controlled && value !== seenValue) {
    setSeenValue(value);
    if (value !== draftToNumber(edit.draft)) {
      setEdit({ draft: numberToDraft(value, fractionDigits), caret: null });
    }
  }

  // Changing currency re-formats the amount for the new one: decimals it does not allow are
  // rounded away (USD 12.50 -> COP 13), and the rounded number is reported through onValueChange.
  // Going the other way keeps the number as is (COP 13 -> USD 13).
  if (currency !== seenCurrency) {
    setSeenCurrency(currency);
    const rounded = roundDraft(edit.draft, fractionDigits);
    if (rounded !== edit.draft) setEdit({ draft: rounded, caret: null });
  }

  const display = formatDraft(edit.draft, currency, activeLocale);
  const numericValue = draftToNumber(edit.draft);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(numericValue);

  // Every change (typing, paste, currency rounding) is reported from one place.
  useEffect(() => {
    if (numericValue === lastEmitted.current) return;
    lastEmitted.current = numericValue;
    if (controlled && numericValue === value) return;
    onValueChange?.(numericValue);
  }, [numericValue, controlled, value, onValueChange]);

  // Put the caret back after React writes the re-formatted text (which moves it to the end).
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (edit.caret === null || !input || input.ownerDocument.activeElement !== input) return;
    const position = draftCaretToDisplay(display, edit.caret, separators);
    input.setSelectionRange(position, position);
  }, [edit, display, separators]);

  // Measure the symbol so the padding on its side fits "$", "€" or a code like "XYZ" alike.
  const adornmentRef = useRef<HTMLSpanElement>(null);
  const [adornmentWidth, setAdornmentWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const node = adornmentRef.current;
    if (!node) return;
    const measure = () => setAdornmentWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function apply(result: BuildResult, fallbackCaret: number) {
    if (result === 'reject') {
      // Re-render with the same draft so React restores the text, and keep the caret where it was.
      setEdit({ draft: edit.draft, caret: fallbackCaret });
      return;
    }
    setEdit(result);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const caret = event.target.selectionStart ?? next.length;
    const inputType = inputTypeOf(event);

    // Diff against the current display: the text after the caret is untouched; find the common start.
    const suffixLength = next.length - caret;
    let prefixLength = 0;
    const prefixLimit = Math.min(caret, display.length - suffixLength);
    while (prefixLength < prefixLimit && display[prefixLength] === next[prefixLength]) prefixLength++;
    const suffixMatches =
      suffixLength <= display.length && display.slice(display.length - suffixLength) === next.slice(caret);

    if (!suffixMatches || prefixLimit < 0) {
      // Unrecognized edit (autofill, IME replacement): read the whole text like a paste.
      apply(buildDraft('', normalizePastedText(next), '', fractionDigits, true), edit.draft.length);
      return;
    }

    let before = displayToDraftChars(display.slice(0, prefixLength), separators);
    let after = displayToDraftChars(display.slice(display.length - suffixLength), separators);
    const removed = display.slice(prefixLength, display.length - suffixLength);
    const inserted = next.slice(prefixLength, caret);

    if (inserted === '' && isOnlyGrouping(removed, separators)) {
      // Deleting just a group separator would be undone by re-formatting; remove the digit beside it.
      if (inputType === 'deleteContentForward') after = after.slice(1);
      else before = before.slice(0, -1);
      apply(buildDraft(before, '', after, fractionDigits, false), before.length);
      return;
    }

    let insertedDraft: string;
    if (inserted.length <= 1) {
      // A keystroke: "." and "," both act as the decimal key, whatever the locale's separator is.
      insertedDraft =
        inserted === '.' || inserted === ',' || inserted === separators.decimal ? '.' : inserted.replace(/\D/g, '');
      if (inserted !== '' && insertedDraft === '') {
        apply('reject', before.length);
        return;
      }
      if (insertedDraft === '.' && fractionDigits === 0) {
        // Whole-unit currency (COP): the decimal key does nothing.
        apply('reject', before.length);
        return;
      }
      if (insertedDraft === '.' && (before.includes('.') || after.includes('.'))) {
        apply('reject', before.length);
        return;
      }
    } else {
      insertedDraft = normalizePastedText(inserted);
    }

    const result = buildDraft(before, insertedDraft, after, fractionDigits, inserted.length > 1);
    apply(result, before.length);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text/plain');
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? display.length;
    const end = input.selectionEnd ?? display.length;
    const before = displayToDraftChars(display.slice(0, start), separators);
    const after = displayToDraftChars(display.slice(end), separators);
    const pasted = normalizePastedText(text);
    // Nothing numeric on the clipboard: leave the field as it is rather than wiping the selection.
    if (!/\d/.test(pasted)) return;
    apply(buildDraft(before, pasted, after, fractionDigits, true), before.length);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const settled = settleDraft(edit.draft, fractionDigits);
    if (settled !== edit.draft) setEdit({ draft: settled, caret: null });
    onBlur?.(event);
  }

  // Before measuring, estimate the symbol at ~0.65em per character so the first frame is close.
  const adornment = adornmentWidth === null ? `${symbol.length * 0.65}em` : `${adornmentWidth}px`;
  const suffix = position === 'suffix';
  // Prefix: the symbol sits at the field's leading inset and the right-aligned digits keep a 0.5rem
  // gap from it. Suffix: the symbol sits at the trailing inset and the digits end right before it,
  // a word space apart when the locale writes one ("12,50 €"), a hair apart when it does not.
  const padding = suffix
    ? { paddingRight: `calc(${adornment} + 0.75rem + ${spaced ? '0.3em' : '0.125em'})` }
    : { paddingLeft: `calc(${adornment} + 1.25rem)` };

  return (
    <div className={cn('relative', wrapperClassName)}>
      <span
        ref={adornmentRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-base whitespace-nowrap text-ink-muted select-none sm:text-sm',
          suffix ? 'right-3' : 'left-3',
          disabled && 'opacity-60',
        )}
      >
        {symbol}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        className={cn(fieldControlStyles, 'text-right tabular-nums', className)}
        style={{ ...padding, ...style }}
        {...props}
      />
      {name ? (
        <input
          type="hidden"
          name={name}
          value={numericValue === null ? '' : String(numericValue)}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

export interface MoneyFieldProps extends Omit<MoneyInputProps, 'id' | 'invalid'> {
  /** Required: wires the label, hint and error to the input. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Error message; when present the input is marked invalid. */
  error?: ReactNode;
  /**
   * Screen-reader description naming the currency, since the visible symbol is decorative
   * (e.g. "Amount in Colombian pesos"). Receives the currency's display name.
   */
  currencyDescription?: (currencyName: string) => string;
  className?: string;
  inputClassName?: string;
}

function currencyDisplayName(locale: string, currency: string): string {
  try {
    return new Intl.DisplayNames(locale, { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

/** Label + money input + hint/error, with ids and aria attributes connected (like TextField). */
export function MoneyField({
  id,
  label,
  hint,
  error,
  currencyDescription,
  className,
  inputClassName,
  'aria-describedby': describedBy,
  ...inputProps
}: MoneyFieldProps) {
  const { intlLocale } = useI18n();
  const currencyId = currencyDescription ? `${id}-currency` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedByIds = [describedBy, currencyId, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput
        id={id}
        invalid={Boolean(error)}
        aria-describedby={describedByIds}
        className={inputClassName}
        {...inputProps}
      />
      {currencyDescription ? (
        <span id={currencyId} className="sr-only">
          {currencyDescription(currencyDisplayName(inputProps.locale ?? intlLocale, inputProps.currency))}
        </span>
      ) : null}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}
