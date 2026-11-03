'use client';

import { signUp } from 'aws-amplify/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, TextField } from '@/components/ui/input';
import { PasswordField } from '@/components/ui/password-field';
import { useI18n } from '@/i18n/i18n-provider';
import { type AuthErrorKey, getAuthErrorKey } from '@/lib/auth-errors';
import { firstValidationKey, PENDING_EMAIL_KEY, signUpSchema, type ValidationKey } from '@/lib/auth-schema';

type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', ValidationKey>>;

export function SignUpForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
      const { fieldErrors: errors } = z.flattenError(parsed.error);
      setFieldErrors({
        email: firstValidationKey(errors.email),
        password: firstValidationKey(errors.password),
        confirmPassword: firstValidationKey(errors.confirmPassword),
      });
      return;
    }

    setFieldErrors({});
    setPending(true);

    const { email, password } = parsed.data;

    try {
      const { nextStep } = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        sessionStorage.setItem(PENDING_EMAIL_KEY, email);
        router.push('/confirm-sign-up');
      }
    } catch (error: unknown) {
      // UsernameExistsException also covers unconfirmed accounts. We never resume them from here:
      // that would let whoever registered the email first keep their password (pre-account takeover).
      // The owner finishes a pending sign-up from the sign-in page, which proves the password first.
      setFormError(getAuthErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        id="email"
        name="email"
        type="email"
        label={t.signUp.emailLabel}
        autoComplete="email"
        error={fieldErrors.email && t.validation[fieldErrors.email]}
      />
      <PasswordField
        id="password"
        name="password"
        label={t.signUp.passwordLabel}
        autoComplete="new-password"
        hint={t.signUp.passwordHint}
        error={fieldErrors.password && t.validation[fieldErrors.password]}
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label={t.signUp.confirmPasswordLabel}
        autoComplete="new-password"
        error={fieldErrors.confirmPassword && t.validation[fieldErrors.confirmPassword]}
      />
      {formError && (
        <FieldError role="alert">
          {t.authErrors[formError]}
          {formError === 'usernameExists' && (
            <>
              {' '}
              <Link href="/sign-in" className="font-medium underline underline-offset-4">
                {t.signUp.signInLink}
              </Link>
            </>
          )}
        </FieldError>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? t.signUp.submitting : t.signUp.submit}
      </Button>
    </form>
  );
}
