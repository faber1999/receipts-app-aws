'use client';

import { Amplify } from 'aws-amplify';
import { env } from '@/lib/env';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: env.NEXT_PUBLIC_USER_POOL_ID,
      userPoolClientId: env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
      loginWith: { email: true },
    },
  },
});

export function AmplifyConfig(): null {
  return null;
}
