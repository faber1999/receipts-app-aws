// Money lives in '@/lib/money' (formatMoney, currencyAffix, moneyDisplayFor); this file keeps
// the expense screen's dates and shares.

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string, style: 'row' | 'long' | 'month'): Intl.DateTimeFormat {
  const key = `${locale}|${style}`;
  let format = dateFormats.get(key);
  if (!format) {
    const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
      row: { weekday: 'short', day: 'numeric', month: 'short' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      month: { month: 'long', year: 'numeric' },
    };
    format = new Intl.DateTimeFormat(locale, options[style]);
    dateFormats.set(key, format);
  }
  return format;
}

/** Parses YYYY-MM-DD as a local calendar date (no UTC shift to the previous day). */
function localDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Short date for list rows, e.g. "Tue, Oct 28" / "mar, 28 oct". */
export function formatRowDate(isoDate: string, locale: string): string {
  return dateFormat(locale, 'row').format(localDate(isoDate));
}

/** Full date for sentences, e.g. "October 28, 2026" / "28 de octubre de 2026". */
export function formatLongDate(isoDate: string, locale: string): string {
  return dateFormat(locale, 'long').format(localDate(isoDate));
}

/** Month heading from a YYYY-MM key, e.g. "November 2026" / "Noviembre de 2026". */
export function formatMonth(monthKey: string, locale: string): string {
  return capitalize(dateFormat(locale, 'month').format(localDate(`${monthKey}-01`)), locale);
}

const percentFormats = new Map<string, Intl.NumberFormat>();

/** Whole-number share, e.g. "42%" / "42 %". */
export function formatPercent(share: number, locale: string): string {
  let format = percentFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    percentFormats.set(locale, format);
  }
  return format.format(share);
}
