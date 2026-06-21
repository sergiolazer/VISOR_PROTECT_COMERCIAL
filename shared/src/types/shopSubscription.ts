export const SHOP_SUBSCRIPTION_STATUSES = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
] as const;

export type ShopSubscriptionStatus = (typeof SHOP_SUBSCRIPTION_STATUSES)[number];

/** Duración del periodo de prueba gratuita (días). */
export const TRIAL_DURATION_DAYS = 15;

export interface ShopSubscription {
  status: ShopSubscriptionStatus;
  trialEndsAt: Date;
}

/** Vista expuesta al cliente (API / frontend). */
export interface ShopSubscriptionSnapshot {
  status: ShopSubscriptionStatus;
  trialEndsAt: string;
  daysRemaining: number | null;
  canEmitAlerts: boolean;
  requiresPayment: boolean;
}

export const SUBSCRIPTION_ERROR_CODES = {
  TRIAL_EXPIRED: 'SUBSCRIPTION_TRIAL_EXPIRED',
  PAYMENT_REQUIRED: 'SUBSCRIPTION_PAYMENT_REQUIRED',
  CANCELLED: 'SUBSCRIPTION_CANCELLED',
} as const;

export type SubscriptionErrorCode =
  (typeof SUBSCRIPTION_ERROR_CODES)[keyof typeof SUBSCRIPTION_ERROR_CODES];
