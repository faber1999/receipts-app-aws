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
import {
  currencyAffix,
  currencyFractionDigits,
  formatMoneyNumber,
  type NumberSeparators,
  numberSeparators,
} from '@/lib/money';
import { FieldError, FieldHint, fieldControlStyles, Label } from './input';

/*
 * Amounts are edited as a canonical "draft" string: ASCII digits plus at most one "." for the
 * decimal point, e.g. "123123", "12." or "12.5". The draft is what the user typed, so a trailing
 * point survives while typing; the display string is derived from it with the locale's separators.
 * The caret is tracked in draft positions (digits and the point), never in display characters,
 * so it stays put while group separators appear and disappear around it.
 */

/** Integer digits beyond this would lose precision as a JS number long before any receipt needs them. */
const MAX_INTEGER_DIGITS = 12;

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

/** Draft to display, e.g. "1234567.5" -> "1,234,567.5" (en-US) or "1.234.567,5" (es-CO). */
function formatDraft(draft: string, currency: string, locale: string): string {
  if (draft === '') return '';
  const [integer = '', fraction] = draft.split('.');
  // Only the integer goes through Intl; the fraction stays as typed so "12.5" does not jump to "12.50".
  const grouped = formatMoneyNumber(Number(integer || '0'), currency, locale, { fractionDigits: 0 });
  return fraction === undefined ? grouped : `${grouped}${numberSeparators(locale).decimal}${fraction}`;
}

function draftToNumber(draft: string): number | null {
  if (draft === '' || draft === '.') return null;
  const value = Number(draft);
  return Number.isFinite(value) ? value : null;
}

function stripLeadingZeros(integer: string): string {
  return integer.replace(/^0+(?=\d)/, '');
}

/** Adds one to a string of digits, carrying as needed ("199" -> "200"). */
function incrementDigits(digits: string): string {
  const chars = digits.split('');
  for (let index = chars.length - 1; index >= 0; index--) {
    if (chars[index] === '9') {
      chars[index] = '0';
    } else {
      chars[index] = String(Number(chars[index]) + 1);
      return chars.join('');
    }
  }
  return `1${chars.join('')}`;
}

/** Rounds a draft half-up to `fractionDigits`, on the digits themselves so no float error creeps in. */
function roundDraft(draft: string, fractionDigits: number): string {
  const [integer = '', fraction] = draft.split('.');
  if (fraction === undefined) return draft;
  if (fraction.length <= fractionDigits) {
    return fractionDigits === 0 ? integer || (draft === '.' ? '' : '0') : draft;
  }
  const roundUp = (fraction[fractionDigits] ?? '0') >= '5';
  let digits = (integer || '0') + fraction.slice(0, fractionDigits);
  if (roundUp) digits = incrementDigits(digits);
  const nextInteger = stripLeadingZeros(digits.slice(0, digits.length - fractionDigits) || '0');
  return fractionDigits === 0 ? nextInteger : `${nextInteger}.${digits.slice(digits.length - fractionDigits)}`;
}

/** Number to draft for a value coming from outside (edit form, controlled prop). */
function numberToDraft(value: number | null | undefined, fractionDigits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '';
  const fixed = value.toFixed(fractionDigits);
  // Whole amounts read as "12", not "12.00"; partial ones keep every minor digit ("12.50").
  return /\.0+$/.test(fixed) ? fixed.replace(/\.0+$/, '') : fixed;
}

/** Tidies a draft when the field loses focus: no dangling point, minor units padded ("12.5" -> "12.50"). */
function settleDraft(draft: string, fractionDigits: number): string {
  if (draft === '.' || draft === '') return '';
  if (draft.endsWith('.')) return draft.slice(0, -1);
  const [integer = '', fraction] = draft.split('.');
  if (fraction === undefined) return draft;
  return `${integer || '0'}.${fraction.padEnd(fractionDigits, '0')}`;
}

/**
 * Display text (or a slice of it) back to draft characters: digits, plus "." for the locale's
 * decimal separator. Group separators and anything else are dropped.
 */
function displayToDraftChars(text: string, separators: NumberSeparators): string {
  let out = '';
  for (const char of text) {
    if (isDigit(char)) out += char;
    else if (char === separators.decimal) out += '.';
  }
  return out;
}

/**
 * Normalizes pasted or autofilled text such as "$ 1.234.567", "1,234.50", "86 450" or "-12,5".
 * Currency symbols, spaces and signs are dropped (amounts are never negative). When both "." and ","
 * appear, the last one is the decimal point. A single separator kind repeated is grouping; once,
 * followed by exactly three digits, it is grouping too ("1.234"), unless the integer part is 0.
 */
function normalizePastedText(text: string): string {
  const cleaned = text.replace(/[^\d.,]/g, '');
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot === -1 && lastComma === -1) return cleaned;

  let decimalIndex = -1;
  if (lastDot !== -1 && lastComma !== -1) {
    decimalIndex = Math.max(lastDot, lastComma);
  } else {
    const separator = lastDot !== -1 ? '.' : ',';
    const index = Math.max(lastDot, lastComma);
    const occurrences = cleaned.split(separator).length - 1;
    const digitsAfter = cleaned.length - index - 1;
    const integerPart = cleaned.slice(0, index).replace(/\D/g, '');
    const looksGrouped =
      occurrences > 1 || (digitsAfter === 3 && stripLeadingZeros(integerPart) !== '0' && integerPart !== '');
    decimalIndex = looksGrouped ? -1 : index;
  }

  let out = '';
  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned.charAt(index);
    if (isDigit(char)) out += char;
    else if (index === decimalIndex) out += '.';
  }
  return out;
}

interface DraftEdit {
  draft: string;
  /** Caret as a draft index, or null to leave the selection alone. */
  caret: number | null;
}

type BuildResult = DraftEdit | 'reject';

/**
 * Joins the untouched text before the caret, the new characters and the untouched text after,
 * then canonicalizes: one decimal point at most (the existing one wins over a newly typed one),
 * no leading zeros, minor units within the currency's limit. Typing past a limit is rejected;
 * a paste past the fraction limit is rounded instead.
 */
function buildDraft(
  before: string,
  inserted: string,
  after: string,
  fractionDigits: number,
  fromPaste: boolean,
): BuildResult {
  // Whole-unit currency: a paste that replaces the whole field keeps its point so it rounds
  // ("1234,56" -> 1235); anywhere else the minor units are dropped ("12|34" + "5,6" -> 12534).
  const wholePaste = fromPaste && before === '' && after === '';
  const insertedChars = fractionDigits === 0 && !wholePaste ? (inserted.split('.')[0] ?? '') : inserted;
  const existingPoint = before.includes('.') || after.includes('.');
  // Keep the first point of the inserted text, and only when the existing text has none.
  let pointSeen = existingPoint || (fractionDigits === 0 && !wholePaste);
  let insertedClean = '';
  for (const char of insertedChars) {
    if (char === '.') {
      if (pointSeen) continue;
      pointSeen = true;
    }
    insertedClean += char;
  }
  const beforeClean = fractionDigits === 0 ? before.replace(/\./g, '') : before;
  const afterClean = fractionDigits === 0 ? after.replace(/\./g, '') : after;

  let draft = beforeClean + insertedClean + afterClean;
  let caret = beforeClean.length + insertedClean.length;

  const pointIndex = draft.indexOf('.');
  const integer = pointIndex === -1 ? draft : draft.slice(0, pointIndex);
  const fraction = pointIndex === -1 ? null : draft.slice(pointIndex + 1);

  // Leading zeros: "007" -> "7", ".5" -> "0.5". Shift the caret by the zeros removed before it.
  let normalizedInteger = stripLeadingZeros(integer);
  const removed = integer.length - normalizedInteger.length;
  caret -= Math.min(removed, caret);
  if (normalizedInteger === '' && fraction !== null) {
    normalizedInteger = '0';
    caret += 1;
  }

  if (normalizedInteger.length > MAX_INTEGER_DIGITS) return 'reject';
  draft = fraction === null ? normalizedInteger : `${normalizedInteger}.${fraction}`;

  if (fraction !== null && fraction.length > fractionDigits) {
    if (!fromPaste) return 'reject';
    draft = roundDraft(draft, fractionDigits);
    caret = draft.length;
  }

  return { draft, caret: Math.min(caret, draft.length) };
}

/** Draft caret index to display index: walk the display, counting only digits and the decimal separator. */
function draftCaretToDisplay(display: string, caret: number, separators: NumberSeparators): number {
  let counted = 0;
  let index = 0;
  while (counted < caret && index < display.length) {
    const char = display.charAt(index);
    if (isDigit(char) || char === separators.decimal) counted++;
    index++;
  }
  return index;
}

function inputTypeOf(event: ChangeEvent<HTMLInputElement>): string {
  return event.nativeEvent instanceof InputEvent ? event.nativeEvent.inputType : '';
}

/** Characters of a display string that are only group separators (no digits, no decimal). */
function isOnlyGrouping(text: string, separators: NumberSeparators): boolean {
  return text !== '' && displayToDraftChars(text, separators) === '';
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
