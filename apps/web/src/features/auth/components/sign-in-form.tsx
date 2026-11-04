'use client';

import { resendSignUpCode, signIn } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, TextField } from '@/components/ui/input';
import { PasswordField } from '@/components/ui/password-field';
import { type AuthErrorKey, getAuthErrorKey } from '@/features/auth/errors';
import { type AuthNotice, takeAuthNotice } from '@/features/auth/notice';
import { firstValidationKey, PENDING_EMAIL_KEY, signInSchema, type ValidationKey } from '@/features/auth/schemas';
import { useI18n } from '@/i18n/i18n-provider';

type FieldErrors = Partial<Record<'email' | 'password', ValidationKey>>;

export function SignInForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [pending, setPending] = useState(false);

  // Only set when present, so React's double effect run in dev doesn't wipe it.
  useEffect(() => {
    const pendingNotice = takeAuthNotice();
    if (pendingNotice) {
      setNotice(pendingNotice);
    }
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!parsed.success) {
      const { fieldErrors: errors } = z.flattenError(parsed.error);
      setFieldErrors({
        email: firstValidationKey(errors.email),
        password: firstValidationKey(errors.password),
      });
      return;
    }

    setFieldErrors({});
    setPending(true);

    const { email, password } = parsed.data;

    try {
      const { nextStep } = await signIn({ username: email, password });

      if (nextStep.signInStep === 'DONE') {
        router.push('/expenses');
        return;
      }

      if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        // Cognito only reports an unconfirmed account after the password checks out,
        // so this is the person who registered it: safe to resume the sign-up.
        await resendSignUpCode({ username: email });
        sessionStorage.setItem(PENDING_EMAIL_KEY, email);
        router.push('/confirm-sign-up');
        return;
      }

      setFormError('unknown');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'UserAlreadyAuthenticatedException') {
        router.push('/expenses');
        return;
      }
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {notice && (
        <p role="status" className="rounded-md bg-primary-soft px-3 py-2 text-sm text-primary-ink">
          {t.signIn[notice]}
        </p>
      )}
      <TextField
        id="email"
        name="email"
        type="email"
        label={t.signIn.emailLabel}
        autoComplete="email"
        error={fieldErrors.email && t.validation[fieldErrors.email]}
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          id="password"
          name="password"
          label={t.signIn.passwordLabel}
          autoComplete="current-password"
          error={fieldErrors.password && t.validation[fieldErrors.password]}
        />
        <Link
          href="/forgot-password"
          className="self-end text-sm font-medium text-primary underline underline-offset-4"
        >
          {t.signIn.forgotPassword}
        </Link>
      </div>
      {formError && <FieldError role="alert">{t.authErrors[formError]}</FieldError>}
      <Button type="submit" block disabled={pending}>
        {pending ? t.signIn.submitting : t.signIn.submit}
      </Button>
    </form>
  );
}
