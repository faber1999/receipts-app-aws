import type { Metadata } from 'next';
import { HomeView } from './home-view';

export const metadata: Metadata = {
  title: { absolute: 'Receipts App · Your spending from a photo' },
};

export default function HomePage() {
  return <HomeView />;
}
