'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDownIcon, UserIcon } from '@/components/icons';
import { ButtonLink } from '@/components/ui/button';
import { Menu, MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { type AuthState, useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/i18n/i18n-provider';

/** Routes that already are the way in: a header "Sign in" link there would only repeat the page. */
const AUTH_ROUTES = new Set(['/sign-in', '/sign-up', '/confirm-sign-up', '/forgot-password']);

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

type SignOutPhase = 'idle' | 'leaving' | 'signingOut';

/**
 * Header account control, wired to the session. Sign out first leaves for `/`
 * and only then ends the session, so a protected screen never sees the
 * signed-out state and redirects to /sign-in on its own.
 */
export function AccountMenu() {
  const { auth, signOut } = useAuth();
  const router = useRouter();
  const pathname = normalizePath(usePathname());
  const [phase, setPhase] = useState<SignOutPhase>('idle');

  useEffect(() => {
    if (phase !== 'leaving' || pathname !== '/') return;
    setPhase('signingOut');
    signOut()
      .catch(() => undefined)
      .finally(() => setPhase('idle'));
  }, [phase, pathname, signOut]);

  function handleSignOut(): void {
    setPhase('leaving');
    router.replace('/');
  }

  return <AccountMenuView auth={auth} pathname={pathname} signingOut={phase !== 'idle'} onSignOut={handleSignOut} />;
}

export interface AccountMenuViewProps {
  auth: AuthState;
  /** Current route, normalized without a trailing slash. */
  pathname: string;
  signingOut: boolean;
  onSignOut: () => void;
}

/** Presentational account control: a quiet placeholder, a "Sign in" link, or the account menu. */
export function AccountMenuView({ auth, pathname, signingOut, onSignOut }: AccountMenuViewProps) {
  const { t } = useI18n();

  if (auth.status === 'loading') {
    // Holds the trigger's footprint so nothing else in the header moves when the session resolves.
    return <span aria-hidden="true" className="block size-10" />;
  }

  if (auth.status === 'signedOut') {
    if (AUTH_ROUTES.has(pathname)) return null;
    return (
      <ButtonLink href="/sign-in" variant="ghost" size="sm" static>
        {t.account.signIn}
      </ButtonLink>
    );
  }

  const { email } = auth;
  const initial = email.charAt(0).toUpperCase();

  return (
    <Menu
      // Below sm the panel anchors to the header's right cluster, so it never runs off a 320px screen.
      className="max-sm:static"
      contentClassName="w-64 max-w-[calc(100vw-2rem)]"
      triggerLabel={t.account.menuLabel(email)}
      triggerClassName={
        'group flex h-10 min-w-10 items-center justify-center gap-2 rounded-full p-1.5 text-sm font-medium text-ink ' +
        'transition-[background-color] duration-(--duration-quick) ease-standard ' +
        'hover:bg-surface-muted aria-expanded:bg-surface-muted sm:pr-2.5'
      }
      trigger={
        <>
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink"
          >
            {initial || <UserIcon className="size-3.5" />}
          </span>
          <span className="hidden max-w-48 truncate sm:block">{email}</span>
          <ChevronDownIcon className="hidden text-ink-subtle transition-transform duration-(--duration-quick) ease-standard group-aria-expanded:rotate-180 sm:block" />
        </>
      }
      header={
        <>
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="text-xs text-ink-muted">{t.account.signedInAs}</p>
            <p className="mt-0.5 text-sm font-medium text-ink [overflow-wrap:anywhere]">{email}</p>
          </div>
          <div aria-hidden="true" className="-mx-1 mb-1 h-px bg-line" />
        </>
      }
    >
      <MenuLinkItem href="/expenses" aria-current={pathname === '/expenses' ? 'page' : undefined}>
        {t.account.expensesLink}
      </MenuLinkItem>
      <MenuItem onSelect={onSignOut} keepOpen disabled={signingOut}>
        {signingOut ? t.account.signingOut : t.account.signOut}
      </MenuItem>
    </Menu>
  );
}
