import type { Metadata } from 'next';
import { ExpensesView } from '@/features/expenses/components/expenses-view';

export const metadata: Metadata = {
  title: 'Your expenses',
};

export default function ExpensesPage() {
  return <ExpensesView />;
}
