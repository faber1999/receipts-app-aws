import { formatMoneyNumber, type NumberSeparators, numberSeparators } from './money';

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
export function formatDraft(draft: string, currency: string, locale: string): string {
  if (draft === '') return '';
  const [integer = '', fraction] = draft.split('.');
  // Only the integer goes through Intl; the fraction stays as typed so "12.5" does not jump to "12.50".
  const grouped = formatMoneyNumber(Number(integer || '0'), currency, locale, { fractionDigits: 0 });
  return fraction === undefined ? grouped : `${grouped}${numberSeparators(locale).decimal}${fraction}`;
}

export function draftToNumber(draft: string): number | null {
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
export function roundDraft(draft: string, fractionDigits: number): string {
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
export function numberToDraft(value: number | null | undefined, fractionDigits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '';
  const fixed = value.toFixed(fractionDigits);
  // Whole amounts read as "12", not "12.00"; partial ones keep every minor digit ("12.50").
  return /\.0+$/.test(fixed) ? fixed.replace(/\.0+$/, '') : fixed;
}

/** Tidies a draft when the field loses focus: no dangling point, minor units padded ("12.5" -> "12.50"). */
export function settleDraft(draft: string, fractionDigits: number): string {
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
export function displayToDraftChars(text: string, separators: NumberSeparators): string {
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
export function normalizePastedText(text: string): string {
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

export interface DraftEdit {
  draft: string;
  /** Caret as a draft index, or null to leave the selection alone. */
  caret: number | null;
}

export type BuildResult = DraftEdit | 'reject';

/**
 * Joins the untouched text before the caret, the new characters and the untouched text after,
 * then canonicalizes: one decimal point at most (the existing one wins over a newly typed one),
 * no leading zeros, minor units within the currency's limit. Typing past a limit is rejected;
 * a paste past the fraction limit is rounded instead.
 */
export function buildDraft(
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
export function draftCaretToDisplay(display: string, caret: number, separators: NumberSeparators): number {
  let counted = 0;
  let index = 0;
  while (counted < caret && index < display.length) {
    const char = display.charAt(index);
    if (isDigit(char) || char === separators.decimal) counted++;
    index++;
  }
  return index;
}

/** Characters of a display string that are only group separators (no digits, no decimal). */
export function isOnlyGrouping(text: string, separators: NumberSeparators): boolean {
  return text !== '' && displayToDraftChars(text, separators) === '';
}
