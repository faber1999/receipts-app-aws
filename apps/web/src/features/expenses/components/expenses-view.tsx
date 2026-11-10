'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { createExpense, deleteExpense, listExpenses, updateExpense } from '@/features/expenses/api';
import { uploadReceipt } from '@/features/receipts/api';
import { type ExpensesApi, ExpensesWorkspace } from './expenses-workspace';

const expensesApi: ExpensesApi = {
  list: listExpenses,
  create: createExpense,
  update: updateExpense,
  remove: deleteExpense,
  uploadReceipt,
};

export function ExpensesView() {
  const router = useRouter();
  const { auth } = useAuth();

  // Client-side guard only: it keeps signed-out visitors off this screen, but the real
  // protection is the API rejecting requests without a valid Cognito JWT.
  useEffect(() => {
    if (auth.status === 'signedOut') {
      router.replace('/sign-in');
    }
  }, [auth.status, router]);

  const handleUnauthorized = useCallback(() => {
    router.replace('/sign-in');
  }, [router]);

  if (auth.status !== 'signedIn') {
    return <section aria-busy="true" className="flex-1" />;
  }

  return <ExpensesWorkspace api={expensesApi} onUnauthorized={handleUnauthorized} />;
}
