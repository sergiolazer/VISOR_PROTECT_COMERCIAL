export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_CREDENTIALS' | 'USER_INACTIVE' | 'UNAUTHORIZED' | 'TOKEN_INVALID',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
