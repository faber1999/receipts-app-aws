'use client';

import { signUp } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, TextField } from '@/components/ui/input';
import { useI18n } from '@/i18n/i18n-provider';
import { type AuthErrorKey, getAuthErrorKey } from '@/lib/auth-errors';
import { isValidationKey, PENDING_EMAIL_KEY, signUpSchema, type ValidationKey } from '@/lib/auth-schema';

type FieldErrors = Partial<Record<'email' | 'password', ValidationKey>>;

function firstValidationKey(messages: string[] | undefined): ValidationKey | undefined {
  const first = messages?.[0];
  return isValidationKey(first) ? first : undefined;
}

export function SignUpForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
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

    try {
      const { email, password } = parsed.data;
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
      <TextField
        id="password"
        name="password"
        type="password"
        label={t.signUp.passwordLabel}
        autoComplete="new-password"
        hint={t.signUp.passwordHint}
        error={fieldErrors.password && t.validation[fieldErrors.password]}
      />
      {formError && <FieldError role="alert">{t.authErrors[formError]}</FieldError>}
      <Button type="submit" block disabled={pending}>
        {pending ? t.signUp.submitting : t.signUp.submit}
      </Button>
    </form>
  );
}
