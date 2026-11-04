import type { Metadata } from 'next';
import { GuestOnly } from '@/features/auth/components/guest-only';
import { HomeView } from '@/features/home/components/home-view';

export const metadata: Metadata = {
  title: { absolute: 'Receipts App · Expenses from receipt photos' },
};

export default function HomePage() {
  return (
    <GuestOnly>
      <HomeView />
    </GuestOnly>
  );
}
