import type { SubscriptionErrorCode } from '@visor-protect/shared';

export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;

  constructor(message: string, code: SubscriptionErrorCode) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
  }
}
