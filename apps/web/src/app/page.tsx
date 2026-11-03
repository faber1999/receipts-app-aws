import type { Metadata } from 'next';
import { HomeView } from './home-view';

export const metadata: Metadata = {
  title: { absolute: 'Receipts App · Expenses from receipt photos' },
};

export default function HomePage() {
  return <HomeView />;
}
