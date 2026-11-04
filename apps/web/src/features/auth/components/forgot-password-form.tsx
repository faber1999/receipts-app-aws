'use client';

import { confirmResetPassword, resetPassword } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { FieldError, TextField } from '@/components/ui/input';
import { OtpField } from '@/components/ui/otp-input';
import { PasswordField } from '@/components/ui/password-field';
import { type AuthErrorKey, getAuthErrorKey } from '@/features/auth/errors';
import { setAuthNotice } from '@/features/auth/notice';
import {
  firstValidationKey,
  forgotPasswordSchema,
  resetPasswordSchema,
  type ValidationKey,
} from '@/features/auth/schemas';
import { useI18n } from '@/i18n/i18n-provider';

type Step = 'request' | 'reset';
type FieldErrors = Partial<Record<'email' | 'code' | 'password' | 'confirmPassword', ValidationKey>>;

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [codeResent, setCodeResent] = useState(false);
  const [pending, setPending] = useState(false);

  // Move focus to the first new field when the form switches to the code step.
  useEffect(() => {
    if (step === 'reset') {
      document.getElementById('code')?.focus();
    }
  }, [step]);

  function resetMessages(): void {
    setFormError(null);
    setCodeResent(false);
  }

  /** Asks Cognito to email a reset code. Returns true when the code step should follow. */
  async function sendCode(username: string): Promise<boolean> {
    const { nextStep } = await resetPassword({ username });
    return nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE';
  }

  async function handleRequest(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    resetMessages();

    const formData = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

    if (!parsed.success) {
      const { fieldErrors: errors } = z.flattenError(parsed.error);
      setFieldErrors({ email: firstValidationKey(errors.email) });
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      if (await sendCode(parsed.data.email)) {
        setEmail(parsed.data.email);
        setStep('reset');
      }
    } catch (error: unknown) {
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    resetMessages();

    const formData = new FormData(event.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      email,
      code: formData.get('code'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      const { fieldErrors: errors } = z.flattenError(parsed.error);
      setFieldErrors({
        code: firstValidationKey(errors.code),
        password: firstValidationKey(errors.password),
        confirmPassword: firstValidationKey(errors.confirmPassword),
      });
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const { code, password } = parsed.data;
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword: password });
      setAuthNotice('passwordReset');
      router.push('/sign-in');
    } catch (error: unknown) {
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  async function handleResend(): Promise<void> {
    resetMessages();
    setPending(true);

    try {
      await sendCode(email);
      setCodeResent(true);
    } catch (error: unknown) {
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  const errorMessage = formError && <FieldError role="alert">{t.authErrors[formError]}</FieldError>;

  if (step === 'request') {
    return (
      <form onSubmit={handleRequest} noValidate className="flex flex-col gap-5">
        <CardDescription>{t.forgotPassword.requestDescription}</CardDescription>
        <TextField
          id="email"
          name="email"
          type="email"
          label={t.forgotPassword.emailLabel}
          autoComplete="email"
          error={fieldErrors.email && t.validation[fieldErrors.email]}
        />
        {errorMessage}
        <Button type="submit" block disabled={pending}>
          {pending ? t.forgotPassword.sendingCode : t.forgotPassword.sendCode}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleReset} noValidate className="flex flex-col gap-5">
      <CardDescription>{t.forgotPassword.resetDescription}</CardDescription>
      <OtpField
        id="code"
        name="code"
        label={t.forgotPassword.codeLabel}
        error={fieldErrors.code && t.validation[fieldErrors.code]}
      />
      <PasswordField
        id="password"
        name="password"
        label={t.forgotPassword.newPasswordLabel}
        autoComplete="new-password"
        hint={t.signUp.passwordHint}
        error={fieldErrors.password && t.validation[fieldErrors.password]}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t.forgotPassword.confirmPasswordLabel}
        autoComplete="new-password"
        error={fieldErrors.confirmPassword && t.validation[fieldErrors.confirmPassword]}
      />
      {errorMessage}
      <p role="status" className="text-sm text-primary-ink empty:hidden">
        {codeResent ? t.forgotPassword.resent : ''}
      </p>
      <div className="flex flex-col gap-2">
        <Button type="submit" block disabled={pending}>
          {pending ? t.forgotPassword.submitting : t.forgotPassword.submit}
        </Button>
        <Button type="button" variant="ghost" block disabled={pending} onClick={handleResend}>
          {t.forgotPassword.resend}
        </Button>
      </div>
    </form>
  );
}
