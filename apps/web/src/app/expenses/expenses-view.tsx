'use client';

import { fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/i18n-provider';

export function ExpensesView() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Client-side guard only: it keeps signed-out visitors off this screen, but the real
  // protection will be the API rejecting requests without a valid Cognito JWT.
  useEffect(() => {
    let active = true;

    fetchUserAttributes()
      .then((attributes) => {
        if (active) {
          setEmail(attributes.email ?? '');
        }
      })
      .catch(() => {
        router.replace('/sign-in');
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.push('/');
    }
  }

  if (email === null) {
    return <section aria-busy="true" className="flex-1" />;
  }

  return (
    <section aria-labelledby="expenses-title" className="flex flex-col items-start gap-5 py-8">
      <h1
        id="expenses-title"
        className="animate-rise font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl"
      >
        {t.expenses.title}
      </h1>
      <p className="stagger-1 max-w-[34rem] animate-rise text-base leading-relaxed text-ink-muted">
        {t.expenses.description}
      </p>
      <p className="stagger-2 animate-rise text-sm text-ink-muted">
        {t.expenses.signedInAs} <span className="font-medium text-ink">{email}</span>
      </p>
      <Button variant="secondary" className="stagger-3 animate-rise" disabled={signingOut} onClick={handleSignOut}>
        {signingOut ? t.expenses.signingOut : t.expenses.signOut}
      </Button>
    </section>
  );
}
