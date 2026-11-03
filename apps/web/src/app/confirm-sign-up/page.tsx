import type { Metadata } from 'next';
import { ConfirmSignUpView } from './confirm-sign-up-view';

export const metadata: Metadata = {
  title: 'Confirm your email',
};

export default function ConfirmSignUpPage() {
  return <ConfirmSignUpView />;
}
