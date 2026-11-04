'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './auth-provider';

/** Sends signed-in users away from guest-only screens (landing, sign-in, sign-up…). */
export function useRedirectIfSignedIn(to = '/expenses'): void {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'signedIn') {
      router.replace(to);
    }
  }, [auth.status, router, to]);
}
