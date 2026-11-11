'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { confirmExpense, createExpense, deleteExpense, listExpenses, updateExpense } from '@/features/expenses/api';
import { getReceiptPhoto, uploadReceipt } from '@/features/receipts/api';
import { withPhotoUrlCache } from '@/features/receipts/photo-url';
import { type ExpensesApi, ExpensesWorkspace } from './expenses-workspace';

const expensesApi: ExpensesApi = {
  list: listExpenses,
  create: createExpense,
  update: updateExpense,
  confirm: confirmExpense,
  remove: deleteExpense,
  uploadReceipt,
  // One cache for the session: reopening a receipt reuses its URL while it is still valid.
  receiptPhoto: withPhotoUrlCache(getReceiptPhoto),
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
