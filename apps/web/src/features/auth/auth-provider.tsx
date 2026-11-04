'use client';

import { signOut as amplifySignOut, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from 'react';

export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; email: string };

interface AuthContextValue {
  auth: AuthState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Session state for the whole app. Amplify keeps the tokens in localStorage; this reads the
 * signed-in user once and follows Amplify's auth events (sign in / sign out / expired session).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    // getCurrentUser reads the session stored in the browser (no request to Cognito unless the
    // access token needs a refresh), so guest-only screens can decide almost immediately.
    // We sign in with the email, so loginId is the email; fetchUserAttributes is only a fallback.
    async function resolveUser(): Promise<AuthState> {
      try {
        const user = await getCurrentUser();
        const email = user.signInDetails?.loginId ?? (await fetchUserAttributes()).email ?? '';
        return { status: 'signedIn', email };
      } catch {
        return { status: 'signedOut' };
      }
    }

    function loadUser(): void {
      void resolveUser().then((state) => {
        if (active) {
          setAuth(state);
        }
      });
    }

    loadUser();

    const stopListening = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        loadUser();
      } else if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure') {
        setAuth({ status: 'signedOut' });
      }
    });

    return () => {
      active = false;
      stopListening();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      signOut: async () => {
        await amplifySignOut();
        setAuth({ status: 'signedOut' });
      },
    }),
    [auth],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
