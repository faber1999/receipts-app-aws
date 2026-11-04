import { z } from 'zod';
import type { Dictionary } from '@/i18n/dictionaries';
import { en } from '@/i18n/dictionaries/en';

export const PENDING_EMAIL_KEY = 'receipts:pending-email';

export type ValidationKey = keyof Dictionary['validation'];

/** Zod messages are dictionary keys, so errors are translated when rendered. */
const message = (key: ValidationKey): ValidationKey => key;

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === 'string' && Object.hasOwn(en.validation, value);
}

export const emailSchema = z.email(message('emailInvalid'));

export const passwordSchema = z
  .string()
  .min(8, message('passwordMinLength'))
  .regex(/[a-z]/, message('passwordLowercase'))
  .regex(/[A-Z]/, message('passwordUppercase'))
  .regex(/\d/, message('passwordNumber'));

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: message('passwordsMismatch'),
  });

export const signInSchema = z.object({
  email: emailSchema,
  // Only presence: the password policy is enforced at sign-up, and old accounts may predate it.
  password: z.string().min(1, message('passwordRequired')),
});

export const confirmationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, message('codeInvalid'));

export const confirmSignUpSchema = z.object({
  email: emailSchema,
  code: confirmationCodeSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: confirmationCodeSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    error: message('passwordsMismatch'),
  });

export function firstValidationKey(messages: string[] | undefined): ValidationKey | undefined {
  const first = messages?.[0];
  return isValidationKey(first) ? first : undefined;
}
