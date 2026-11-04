/*
 * Money formatting for the whole app. Pure functions over Intl, no React.
 *
 * Symbol policy:
 * - `display: 'narrow'` (the default) uses `currencyDisplay: 'narrowSymbol'`: "$" for COP and USD,
 *   "€" for EUR. Use it wherever only one currency is in view, or the currency is named next to
 *   the amount (the expense form shows it in a select).
 * - `display: 'unambiguous'` uses `currencyDisplay: 'symbol'`, the locale's own disambiguated
 *   form: the locale's home currency keeps its bare symbol and foreign ones get a prefixed or
 *   coded one (en-US: "$" USD, "COP" COP; es-CO: "$" COP, "US$" USD). Use it whenever amounts in
 *   more than one currency share a view; `moneyDisplayFor` picks the right one from a set.
 * - Symbol position and spacing always come from the locale via `formatToParts`
 *   (`currencyAffix`), never from a per-currency rule, so the input adornment and every printed
 *   amount agree.
 */

export type MoneyDisplay = 'narrow' | 'unambiguous';

export interface FormatMoneyOptions {
  /** Defaults to 'narrow'. */
  display?: MoneyDisplay;
  /** Overrides the currency's minor units (both minimum and maximum). */
  fractionDigits?: number;
}

export interface CurrencyAffix {
  /** The symbol or code as the locale writes it for this display, e.g. "$", "US$", "€", "COP". */
  symbol: string;
  /** Whether the symbol goes before ("$ 12") or after ("12 €") the number. */
  position: 'prefix' | 'suffix';
  /** Whether the locale separates symbol and number with a space ("$ 12" vs "$12"). */
  spaced: boolean;
}

export interface NumberSeparators {
  group: string;
  decimal: string;
}

/**
 * Currencies written without minor units in practice. ISO 4217 gives COP two, and older ICU builds
 * still report them; receipts and people never use centavos, so the app always treats COP as whole.
 */
const WHOLE_UNIT_CURRENCIES = new Set(['COP']);

const FALLBACK_FRACTION_DIGITS = 2;

const currencyFormats = new Map<string, Intl.NumberFormat | null>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const affixCache = new Map<string, CurrencyAffix>();
const separatorCache = new Map<string, NumberSeparators>();
const fractionCache = new Map<string, number>();

function currencyDisplayOption(display: MoneyDisplay): 'narrowSymbol' | 'symbol' {
  return display === 'unambiguous' ? 'symbol' : 'narrowSymbol';
}

/** Cached currency formatter, or null when the code is not one Intl accepts (e.g. a bad receipt value). */
function currencyFormat(
  currency: string,
  locale: string,
  display: MoneyDisplay,
  fractionDigits: number,
): Intl.NumberFormat | null {
  const key = `${locale}|${currency}|${display}|${fractionDigits}`;
  if (currencyFormats.has(key)) return currencyFormats.get(key) ?? null;
  let format: Intl.NumberFormat | null;
  try {
    format = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: currencyDisplayOption(display),
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    format = null;
  }
  currencyFormats.set(key, format);
  return format;
}

function numberFormat(locale: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale}|${fractionDigits}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormats.set(key, format);
  }
  return format;
}

/** Minor units the app uses for a currency: COP 0, USD and EUR 2; 2 for an unknown code. */
export function currencyFractionDigits(currency: string, locale: string): number {
  if (WHOLE_UNIT_CURRENCIES.has(currency)) return 0;
  const key = `${locale}|${currency}`;
  let digits = fractionCache.get(key);
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
        FALLBACK_FRACTION_DIGITS;
    } catch {
      digits = FALLBACK_FRACTION_DIGITS;
    }
    fractionCache.set(key, digits);
  }
  return digits;
}

/** Group and decimal separators of a locale, e.g. en-US "," and ".", es-CO "." and ",". */
export function numberSeparators(locale: string): NumberSeparators {
  let separators = separatorCache.get(locale);
  if (!separators) {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
    separators = {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    };
    separatorCache.set(locale, separators);
  }
  return separators;
}

const NUMBER_PART_TYPES = new Set<Intl.NumberFormatPartTypes>(['integer', 'group', 'decimal', 'fraction']);

/**
 * Where the locale puts the currency symbol and whether a space separates it from the number.
 * The single source of truth for the money input's adornment.
 */
export function currencyAffix(currency: string, locale: string, display: MoneyDisplay = 'narrow'): CurrencyAffix {
  const key = `${locale}|${currency}|${display}`;
  let affix = affixCache.get(key);
  if (!affix) {
    const format = currencyFormat(currency, locale, display, currencyFractionDigits(currency, locale));
    const parts = format?.formatToParts(1) ?? [];
    const symbolIndex = parts.findIndex((part) => part.type === 'currency');
    const firstNumber = parts.findIndex((part) => NUMBER_PART_TYPES.has(part.type));
    const lastNumber = parts.findLastIndex((part) => NUMBER_PART_TYPES.has(part.type));
    if (symbolIndex === -1 || firstNumber === -1) {
      // Unknown code: show the code itself, before the number, as formatMoney does.
      affix = { symbol: currency, position: 'prefix', spaced: true };
    } else {
      const position = symbolIndex < firstNumber ? 'prefix' : 'suffix';
      const between =
        position === 'prefix' ? parts.slice(symbolIndex + 1, firstNumber) : parts.slice(lastNumber + 1, symbolIndex);
      affix = {
        symbol: parts[symbolIndex]?.value ?? currency,
        position,
        // \s covers the no-break and narrow no-break spaces Intl actually emits.
        spaced: between.some((part) => part.type === 'literal' && /\s/.test(part.value)),
      };
    }
    affixCache.set(key, affix);
  }
  return affix;
}

/** An amount with its currency symbol, e.g. "$1,235", "$ 1.235", "US$ 12,50", "€12.50". */
export function formatMoney(
  amount: number,
  currency: string,
  locale: string,
  options: FormatMoneyOptions = {},
): string {
  const { display = 'narrow', fractionDigits = currencyFractionDigits(currency, locale) } = options;
  const format = currencyFormat(currency, locale, display, fractionDigits);
  if (format) return format.format(amount);
  return `${currency} ${numberFormat(locale, fractionDigits).format(amount)}`;
}

/**
 * The number part only, grouped and with the currency's minor units for the locale,
 * e.g. 1234.5 USD -> "1,234.50" (en-US) or "1.234,50" (es-CO); 1234.5 COP -> "1.235".
 */
export function formatMoneyNumber(
  amount: number,
  currency: string,
  locale: string,
  options: Pick<FormatMoneyOptions, 'fractionDigits'> = {},
): string {
  const { fractionDigits = currencyFractionDigits(currency, locale) } = options;
  return numberFormat(locale, fractionDigits).format(amount);
}

/** 'unambiguous' as soon as more than one currency is in view, 'narrow' otherwise. */
export function moneyDisplayFor(currencies: Iterable<string>): MoneyDisplay {
  return new Set(currencies).size > 1 ? 'unambiguous' : 'narrow';
}
