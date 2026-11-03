'use client';

import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, TextField } from '@/components/ui/input';
import { useI18n } from '@/i18n/i18n-provider';
import { type AuthErrorKey, getAuthErrorKey } from '@/lib/auth-errors';
import {
  confirmSignUpSchema,
  emailSchema,
  firstValidationKey,
  PENDING_EMAIL_KEY,
  type ValidationKey,
} from '@/lib/auth-schema';

type FieldErrors = Partial<Record<'email' | 'code', ValidationKey>>;

export function ConfirmSignUpForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [codeResent, setCodeResent] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  // The sign-up page left the email in sessionStorage (not in the URL).
  useEffect(() => {
    const stored = sessionStorage.getItem(PENDING_EMAIL_KEY);
    if (stored) {
      setEmail(stored);
    }
  }, []);

  function finish(): void {
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
    router.push('/sign-in');
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setCodeResent(false);

    const formData = new FormData(event.currentTarget);
    const parsed = confirmSignUpSchema.safeParse({
      email: formData.get('email'),
      code: formData.get('code'),
    });

    if (!parsed.success) {
      const { fieldErrors: errors } = z.flattenError(parsed.error);
      setFieldErrors({
        email: firstValidationKey(errors.email),
        code: firstValidationKey(errors.code),
      });
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const { email: username, code } = parsed.data;
      const { nextStep } = await confirmSignUp({ username, confirmationCode: code });

      if (nextStep.signUpStep === 'DONE') {
        finish();
      }
    } catch (error: unknown) {
      // Cognito answers NotAuthorizedException when the user is already confirmed.
      if (error instanceof Error && error.name === 'NotAuthorizedException') {
        finish();
        return;
      }
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  async function handleResend(): Promise<void> {
    setFormError(null);
    setCodeResent(false);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldErrors({ email: 'emailInvalid' });
      return;
    }

    setResending(true);

    try {
      await resendSignUpCode({ username: parsed.data });
      setCodeResent(true);
    } catch (error: unknown) {
      setFormError(getAuthErrorKey(error));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        id="email"
        name="email"
        type="email"
        label={t.confirmSignUp.emailLabel}
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email && t.validation[fieldErrors.email]}
      />
      <TextField
        id="code"
        name="code"
        label={t.confirmSignUp.codeLabel}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        hint={t.confirmSignUp.codeHint}
        error={fieldErrors.code && t.validation[fieldErrors.code]}
      />
      {formError && <FieldError role="alert">{t.authErrors[formError]}</FieldError>}
      <p role="status" className="text-sm text-primary-ink empty:hidden">
        {codeResent ? t.confirmSignUp.resent : ''}
      </p>
      <div className="flex flex-col gap-2">
        <Button type="submit" block disabled={pending}>
          {pending ? t.confirmSignUp.submitting : t.confirmSignUp.submit}
        </Button>
        <Button type="button" variant="ghost" block disabled={resending} onClick={handleResend}>
          {resending ? t.confirmSignUp.resending : t.confirmSignUp.resend}
        </Button>
      </div>
    </form>
  );
}
