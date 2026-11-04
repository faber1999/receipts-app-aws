'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n/i18n-provider';
import { ForgotPasswordForm } from './forgot-password-form';

export function ForgotPasswordView() {
  const { t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-md py-8">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>{t.forgotPassword.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
      <p className="stagger-1 mt-6 animate-rise text-center text-sm text-ink-muted">
        {t.forgotPassword.rememberPassword}{' '}
        <Link href="/sign-in" className="font-medium text-primary underline underline-offset-4">
          {t.forgotPassword.signInLink}
        </Link>
      </p>
    </section>
  );
}
