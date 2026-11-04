import { describe, expect, it } from 'vitest';
import {
  confirmationCodeSchema,
  firstValidationKey,
  isValidationKey,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from './schemas';

/** Messages are dictionary keys, so a failing parse should yield keys, never prose. */
function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('passwordSchema', () => {
  it('accepts a password that meets the policy', () => {
    expect(passwordSchema.safeParse('Receipts1').success).toBe(true);
  });

  it('reports each unmet rule as its dictionary key', () => {
    expect(messages(passwordSchema.safeParse('short'))).toEqual([
      'passwordMinLength',
      'passwordUppercase',
      'passwordNumber',
    ]);
    expect(messages(passwordSchema.safeParse('ALLUPPER1'))).toEqual(['passwordLowercase']);
    expect(messages(passwordSchema.safeParse('NoDigitsHere'))).toEqual(['passwordNumber']);
  });
});

describe('signUpSchema', () => {
  it('flags a confirmation that does not match on the confirm field', () => {
    const result = signUpSchema.safeParse({
      email: 'ana@example.com',
      password: 'Receipts1',
      confirmPassword: 'Receipts2',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['confirmPassword'], message: 'passwordsMismatch' }),
    ]);
  });

  it('rejects an invalid email with its key', () => {
    const result = signUpSchema.safeParse({ email: 'ana', password: 'Receipts1', confirmPassword: 'Receipts1' });
    expect(messages(result)).toEqual(['emailInvalid']);
  });
});

describe('signInSchema', () => {
  it('only requires a password to be present, not the sign-up policy', () => {
    expect(signInSchema.safeParse({ email: 'ana@example.com', password: 'old' }).success).toBe(true);
    expect(messages(signInSchema.safeParse({ email: 'ana@example.com', password: '' }))).toEqual(['passwordRequired']);
  });
});

describe('confirmationCodeSchema', () => {
  it('accepts six digits, trimming surrounding spaces', () => {
    expect(confirmationCodeSchema.parse(' 123456 ')).toBe('123456');
    expect(messages(confirmationCodeSchema.safeParse('12345'))).toEqual(['codeInvalid']);
  });
});

describe('isValidationKey', () => {
  it('recognizes keys of the validation dictionary', () => {
    expect(isValidationKey('passwordMinLength')).toBe(true);
    expect(isValidationKey('passwordsMismatch')).toBe(true);
  });

  it('rejects anything else, including inherited object keys', () => {
    expect(isValidationKey('Invalid input')).toBe(false);
    expect(isValidationKey('toString')).toBe(false);
    expect(isValidationKey(42)).toBe(false);
  });
});

describe('firstValidationKey', () => {
  it('returns the first message only when it is a known key', () => {
    expect(firstValidationKey(['emailInvalid', 'passwordNumber'])).toBe('emailInvalid');
    expect(firstValidationKey(['Invalid input'])).toBeUndefined();
    expect(firstValidationKey(undefined)).toBeUndefined();
  });
});
