import type { Dictionary } from '@/i18n/dictionaries';

export type AuthErrorKey = keyof Dictionary['authErrors'];

/** Cognito API error names (the `name` of errors thrown by Amplify) mapped to dictionary keys. */
const ERROR_KEYS: Record<string, AuthErrorKey> = {
  UsernameExistsException: 'usernameExists',
  InvalidPasswordException: 'invalidPassword',
  InvalidParameterException: 'invalidParameter',
  CodeMismatchException: 'codeMismatch',
  ExpiredCodeException: 'expiredCode',
  NotAuthorizedException: 'notAuthorized',
  UserNotConfirmedException: 'userNotConfirmed',
  LimitExceededException: 'tooManyAttempts',
  TooManyRequestsException: 'tooManyAttempts',
};

export function getAuthErrorKey(error: unknown): AuthErrorKey {
  if (error instanceof Error) {
    return ERROR_KEYS[error.name] ?? 'unknown';
  }
  return 'unknown';
}
