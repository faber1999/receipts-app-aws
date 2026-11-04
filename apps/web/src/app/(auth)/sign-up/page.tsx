import type { Metadata } from 'next';
import { SignUpView } from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function SignUpPage() {
  return <SignUpView />;
}
