/** One-time messages shown on the sign-in page after another auth step finishes. */
export type AuthNotice = 'emailConfirmed' | 'passwordReset';

const AUTH_NOTICE_KEY = 'receipts:auth-notice';

function isAuthNotice(value: unknown): value is AuthNotice {
  return value === 'emailConfirmed' || value === 'passwordReset';
}

export function setAuthNotice(notice: AuthNotice): void {
  sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
}

/** Reads the pending notice and clears it, so it shows only once. */
export function takeAuthNotice(): AuthNotice | null {
  const value = sessionStorage.getItem(AUTH_NOTICE_KEY);
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return isAuthNotice(value) ? value : null;
}
