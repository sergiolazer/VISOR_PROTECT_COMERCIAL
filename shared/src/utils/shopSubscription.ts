import {
  TRIAL_DURATION_DAYS,
  type ShopSubscription,
  type ShopSubscriptionSnapshot,
  type ShopSubscriptionStatus,
} from '../types/shopSubscription';

export function addTrialDays(from: Date, days = TRIAL_DURATION_DAYS): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return end;
}

export function createTrialSubscription(from = new Date()): ShopSubscription {
  return {
    status: 'TRIAL',
    trialEndsAt: addTrialDays(from),
  };
}

export function computeTrialDaysRemaining(trialEndsAt: Date, now = new Date()): number {
  const diffMs = trialEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function canShopEmitAlerts(
  status: ShopSubscriptionStatus,
  trialEndsAt: Date,
  now = new Date(),
): boolean {
  if (status === 'ACTIVE') {
    return true;
  }
  if (status === 'TRIAL') {
    return now.getTime() <= trialEndsAt.getTime();
  }
  return false;
}

export function buildSubscriptionSnapshot(
  status: ShopSubscriptionStatus,
  trialEndsAt: Date,
  now = new Date(),
): ShopSubscriptionSnapshot {
  const daysRemaining = status === 'TRIAL' ? computeTrialDaysRemaining(trialEndsAt, now) : null;
  const canEmit = canShopEmitAlerts(status, trialEndsAt, now);

  return {
    status,
    trialEndsAt: trialEndsAt.toISOString(),
    daysRemaining,
    canEmitAlerts: canEmit,
    requiresPayment: status === 'PAST_DUE' || status === 'CANCELLED',
  };
}
