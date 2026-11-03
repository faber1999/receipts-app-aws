'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n/i18n-provider';
import { ConfirmSignUpForm } from './confirm-sign-up-form';

export function ConfirmSignUpView() {
  const { t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-md py-8">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>{t.confirmSignUp.title}</CardTitle>
          <CardDescription>{t.confirmSignUp.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmSignUpForm />
        </CardContent>
      </Card>
      <p className="stagger-1 mt-6 animate-rise text-center text-sm text-ink-muted">
        {t.confirmSignUp.wrongEmail}{' '}
        <Link href="/sign-up" className="font-medium text-primary underline underline-offset-4">
          {t.confirmSignUp.signUpLink}
        </Link>
      </p>
    </section>
  );
}
