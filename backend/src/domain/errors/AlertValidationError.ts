export const ALERT_ERROR_CODES = {
  SHOP_NOT_FOUND: 'SHOP_NOT_FOUND',
  CITY_MISMATCH: 'CITY_MISMATCH',
  SHOP_NAME_MISMATCH: 'SHOP_NAME_MISMATCH',
  UNAUTHORIZED_SENDER: 'UNAUTHORIZED_SENDER',
  SHOP_NOT_REGISTERED: 'SHOP_NOT_REGISTERED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
} as const;

export type AlertErrorCode = (typeof ALERT_ERROR_CODES)[keyof typeof ALERT_ERROR_CODES];

export class AlertValidationError extends Error {
  readonly code: AlertErrorCode;

  constructor(message: string, code: AlertErrorCode) {
    super(message);
    this.name = 'AlertValidationError';
    this.code = code;
  }
}
