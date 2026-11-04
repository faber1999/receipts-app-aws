'use client';

import { fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '@/features/expenses/api';
import { type ExpensesApi, ExpensesWorkspace } from './expenses-workspace';

const expensesApi: ExpensesApi = {
  list: listExpenses,
  create: createExpense,
  update: updateExpense,
  remove: deleteExpense,
};

export function ExpensesView() {
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

  const handleUnauthorized = useCallback(() => {
    router.replace('/sign-in');
  }, [router]);

  if (email === null) {
    return <section aria-busy="true" className="flex-1" />;
  }

  return (
    <ExpensesWorkspace
      email={email}
      signingOut={signingOut}
      onSignOut={handleSignOut}
      api={expensesApi}
      onUnauthorized={handleUnauthorized}
    />
  );
}
