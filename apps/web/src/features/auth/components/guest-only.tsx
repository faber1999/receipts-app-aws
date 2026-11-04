'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../auth-provider';
import { useRedirectIfSignedIn } from '../use-redirect-if-signed-in';

export interface GuestOnlyProps {
  children: ReactNode;
}

/**
 * Wraps screens that only make sense without a session. Nothing renders until we know the
 * visitor is signed out, so signed-in users never glimpse sign-in/sign-up before the redirect.
 */
export function GuestOnly({ children }: GuestOnlyProps) {
  const { auth } = useAuth();
  useRedirectIfSignedIn();

  return auth.status === 'signedOut' ? children : null;
}
