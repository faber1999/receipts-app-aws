import { describe, expect, it } from 'vitest';
import {
  currencyAffix,
  currencyFractionDigits,
  formatMoney,
  formatMoneyNumber,
  moneyDisplayFor,
  numberSeparators,
} from './money';

/**
 * Intl separates symbol and number with a no-break space (U+00A0) or a narrow no-break space
 * (U+202F), depending on the locale and the ICU version. Folding every whitespace to a plain space
 * keeps the assertions readable and stable across Node releases.
 */
function plain(text: string): string {
  return text.replace(/\s/g, ' ');
}

describe('formatMoney', () => {
  it('writes COP as whole units with the narrow symbol in both locales', () => {
    expect(plain(formatMoney(1234.5, 'COP', 'en-US'))).toBe('$1,235');
    expect(plain(formatMoney(1234.5, 'COP', 'es-CO'))).toBe('$ 1.235');
  });

  it('writes USD and EUR with two minor units and the locale separators', () => {
    expect(plain(formatMoney(1234.5, 'USD', 'en-US'))).toBe('$1,234.50');
    expect(plain(formatMoney(1234.5, 'USD', 'es-CO'))).toBe('$ 1.234,50');
    expect(plain(formatMoney(1234.5, 'EUR', 'en-US'))).toBe('€1,234.50');
  });

  it('disambiguates foreign currencies when display is unambiguous', () => {
    expect(plain(formatMoney(1234.5, 'COP', 'en-US', { display: 'unambiguous' }))).toBe('COP 1,235');
    expect(plain(formatMoney(1234.5, 'USD', 'en-US', { display: 'unambiguous' }))).toBe('$1,234.50');
    expect(plain(formatMoney(1234.5, 'COP', 'es-CO', { display: 'unambiguous' }))).toBe('$ 1.235');
    expect(plain(formatMoney(1234.5, 'USD', 'es-CO', { display: 'unambiguous' }))).toBe('US$ 1.234,50');
  });

  it('honors a fractionDigits override', () => {
    expect(plain(formatMoney(12, 'USD', 'en-US', { fractionDigits: 0 }))).toBe('$12');
  });

  it('falls back to the code before the number for a currency Intl rejects', () => {
    expect(formatMoney(12.5, 'NOT-A-CODE', 'en-US')).toBe('NOT-A-CODE 12.50');
  });
});

describe('formatMoneyNumber', () => {
  it('formats only the number with the currency minor units', () => {
    expect(formatMoneyNumber(1234.5, 'USD', 'en-US')).toBe('1,234.50');
    expect(formatMoneyNumber(1234.5, 'USD', 'es-CO')).toBe('1.234,50');
    expect(formatMoneyNumber(1234.5, 'COP', 'es-CO')).toBe('1.235');
  });
});

describe('currencyFractionDigits', () => {
  it('treats COP as a whole-unit currency', () => {
    expect(currencyFractionDigits('COP', 'es-CO')).toBe(0);
    expect(currencyFractionDigits('COP', 'en-US')).toBe(0);
  });

  it('uses two minor units for USD, EUR and unknown codes', () => {
    expect(currencyFractionDigits('USD', 'en-US')).toBe(2);
    expect(currencyFractionDigits('EUR', 'es-CO')).toBe(2);
    expect(currencyFractionDigits('NOT-A-CODE', 'en-US')).toBe(2);
  });
});

describe('numberSeparators', () => {
  it('reads group and decimal separators from the locale', () => {
    expect(numberSeparators('en-US')).toEqual({ group: ',', decimal: '.' });
    expect(numberSeparators('es-CO')).toEqual({ group: '.', decimal: ',' });
  });
});

describe('currencyAffix', () => {
  it('puts the symbol before the number without a space in en-US', () => {
    expect(currencyAffix('USD', 'en-US')).toEqual({ symbol: '$', position: 'prefix', spaced: false });
  });

  it('puts the symbol before the number with a space in es-CO', () => {
    expect(currencyAffix('COP', 'es-CO')).toEqual({ symbol: '$', position: 'prefix', spaced: true });
  });

  it('puts the symbol after the number in es-ES', () => {
    expect(currencyAffix('EUR', 'es-ES')).toEqual({ symbol: '€', position: 'suffix', spaced: true });
  });

  it('returns the disambiguated symbol for the unambiguous display', () => {
    expect(currencyAffix('USD', 'es-CO', 'unambiguous').symbol).toBe('US$');
  });

  it('falls back to the code as a spaced prefix for a currency Intl rejects', () => {
    expect(currencyAffix('NOT-A-CODE', 'en-US')).toEqual({ symbol: 'NOT-A-CODE', position: 'prefix', spaced: true });
  });
});

describe('moneyDisplayFor', () => {
  it('stays narrow while a single currency is in view', () => {
    expect(moneyDisplayFor([])).toBe('narrow');
    expect(moneyDisplayFor(['COP', 'COP'])).toBe('narrow');
  });

  it('switches to unambiguous once currencies are mixed', () => {
    expect(moneyDisplayFor(['COP', 'USD'])).toBe('unambiguous');
    expect(moneyDisplayFor(new Set(['EUR', 'USD']))).toBe('unambiguous');
  });
});
