import { GuestOnly } from '@/features/auth/components/guest-only';

/** Every route in the (auth) group is for visitors only: signed-in users go to their expenses. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return <GuestOnly>{children}</GuestOnly>;
}
