import { describe, expect, it } from 'vitest';
import { numberSeparators } from './money';
import {
  buildDraft,
  displayToDraftChars,
  draftCaretToDisplay,
  draftToNumber,
  formatDraft,
  isOnlyGrouping,
  normalizePastedText,
  numberToDraft,
  roundDraft,
  settleDraft,
} from './money-draft';

const enUS = numberSeparators('en-US');
const esCO = numberSeparators('es-CO');

describe('formatDraft', () => {
  it('groups the integer with the locale separators', () => {
    expect(formatDraft('1234567', 'COP', 'es-CO')).toBe('1.234.567');
    expect(formatDraft('1234567.5', 'USD', 'en-US')).toBe('1,234,567.5');
    expect(formatDraft('1234567.5', 'USD', 'es-CO')).toBe('1.234.567,5');
  });

  it('keeps the fraction as typed, including a trailing decimal point', () => {
    expect(formatDraft('12.', 'USD', 'en-US')).toBe('12.');
    expect(formatDraft('12.5', 'USD', 'en-US')).toBe('12.5');
  });

  it('renders an empty draft as an empty field', () => {
    expect(formatDraft('', 'USD', 'en-US')).toBe('');
  });
});

describe('draftToNumber', () => {
  it('parses a draft to its amount', () => {
    expect(draftToNumber('1234.5')).toBe(1234.5);
    expect(draftToNumber('12.')).toBe(12);
  });

  it('returns null when there is no amount yet', () => {
    expect(draftToNumber('')).toBeNull();
    expect(draftToNumber('.')).toBeNull();
  });
});

describe('numberToDraft', () => {
  it('writes whole amounts without minor units and partial ones padded', () => {
    expect(numberToDraft(12, 2)).toBe('12');
    expect(numberToDraft(12.5, 2)).toBe('12.50');
    expect(numberToDraft(1234.5, 0)).toBe('1235');
  });

  it('leaves the field empty for missing, negative or non-finite values', () => {
    expect(numberToDraft(null, 2)).toBe('');
    expect(numberToDraft(undefined, 2)).toBe('');
    expect(numberToDraft(-1, 2)).toBe('');
    expect(numberToDraft(Number.NaN, 2)).toBe('');
  });
});

describe('roundDraft', () => {
  it('rounds half-up on the digits, carrying into the integer', () => {
    expect(roundDraft('12.345', 2)).toBe('12.35');
    expect(roundDraft('12.344', 2)).toBe('12.34');
    expect(roundDraft('9.995', 2)).toBe('10.00');
    expect(roundDraft('1234.56', 0)).toBe('1235');
  });

  it('avoids the float error that toFixed would introduce', () => {
    // (1.005).toFixed(2) is "1.00" because 1.005 is stored as 1.00499...; the digits round correctly.
    expect(roundDraft('1.005', 2)).toBe('1.01');
  });

  it('drops a dangling point for whole-unit currencies', () => {
    expect(roundDraft('12.', 0)).toBe('12');
    expect(roundDraft('.', 0)).toBe('');
  });
});

describe('settleDraft', () => {
  it('pads the minor units and drops a dangling point on blur', () => {
    expect(settleDraft('12.5', 2)).toBe('12.50');
    expect(settleDraft('12.', 2)).toBe('12');
    expect(settleDraft('.', 2)).toBe('');
    expect(settleDraft('12', 2)).toBe('12');
  });
});

describe('displayToDraftChars', () => {
  it('keeps digits and maps the locale decimal separator to a point', () => {
    expect(displayToDraftChars('1,234.50', enUS)).toBe('1234.50');
    expect(displayToDraftChars('1.234,50', esCO)).toBe('1234.50');
  });
});

describe('isOnlyGrouping', () => {
  it('is true only for a non-empty slice made of group separators', () => {
    expect(isOnlyGrouping('.', esCO)).toBe(true);
    expect(isOnlyGrouping(',', esCO)).toBe(false);
    expect(isOnlyGrouping('', esCO)).toBe(false);
  });
});

describe('normalizePastedText', () => {
  it('drops symbols, spaces and signs', () => {
    expect(normalizePastedText('$ 1.234.567')).toBe('1234567');
    expect(normalizePastedText('-12,5')).toBe('12.5');
    expect(normalizePastedText('86 450')).toBe('86450');
  });

  it('treats the last separator as decimal when both kinds appear', () => {
    expect(normalizePastedText('1,234.50')).toBe('1234.50');
    expect(normalizePastedText('1.234,50')).toBe('1234.50');
  });

  it('reads a single separator followed by three digits as grouping, unless the integer is zero', () => {
    expect(normalizePastedText('1.234')).toBe('1234');
    expect(normalizePastedText('0.234')).toBe('0.234');
    expect(normalizePastedText('12.34')).toBe('12.34');
  });
});

describe('buildDraft', () => {
  it('strips leading zeros and moves the caret with them', () => {
    expect(buildDraft('', '007', '', 2, false)).toEqual({ draft: '7', caret: 1 });
    expect(buildDraft('', '.5', '', 2, false)).toEqual({ draft: '0.5', caret: 3 });
  });

  it('keeps the existing decimal point over a newly typed one', () => {
    expect(buildDraft('12.3', '.', '', 2, false)).toEqual({ draft: '12.3', caret: 4 });
  });

  it('rejects typing past the minor-unit limit but rounds a paste', () => {
    expect(buildDraft('12.34', '5', '', 2, false)).toBe('reject');
    expect(buildDraft('', '12.345', '', 2, true)).toEqual({ draft: '12.35', caret: 5 });
  });

  it('rounds a whole-field paste for a whole-unit currency and drops minor units elsewhere', () => {
    expect(buildDraft('', '1234.56', '', 0, true)).toEqual({ draft: '1235', caret: 4 });
    expect(buildDraft('12', '5.6', '34', 0, true)).toEqual({ draft: '12534', caret: 3 });
  });

  it('rejects more integer digits than a JS number holds safely', () => {
    expect(buildDraft('999999999999', '9', '', 2, false)).toBe('reject');
  });
});

describe('draftCaretToDisplay', () => {
  it('maps a draft caret past the group separators it skips', () => {
    expect(draftCaretToDisplay('1,234,567', 4, enUS)).toBe(5);
    expect(draftCaretToDisplay('1.234,5', 6, esCO)).toBe(7);
  });
});
