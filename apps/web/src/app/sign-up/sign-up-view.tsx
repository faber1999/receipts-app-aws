'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n/i18n-provider';
import { SignUpForm } from './sign-up-form';

export function SignUpView() {
  const { t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-md py-8">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>{t.signUp.title}</CardTitle>
          <CardDescription>{t.signUp.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
      <p className="stagger-1 mt-6 animate-rise text-center text-sm text-ink-muted">
        {t.signUp.haveAccount}{' '}
        <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
          {t.signUp.signInLink}
        </Link>
      </p>
    </section>
  );
}
