export const ALERT_FILTER_REJECTION_REASONS = [
  'SUBSCRIPTION',
  'OUT_OF_RADIUS',
  'CITY_MISMATCH',
  'SENDER_EXCLUDED',
  'SHOP_NOT_FOUND',
] as const;

export type AlertFilterRejectionReason = (typeof ALERT_FILTER_REJECTION_REASONS)[number];

export interface AlertFilterRejection {
  shopId: string;
  shopName?: string;
  reason: AlertFilterRejectionReason;
  eventType: string;
  distanceMeters?: number;
  radiusMeters?: number;
  subscribedEventTypes?: string[];
}

export interface AlertBroadcastFilterAudit {
  eventId: string;
  eventType: string;
  severity: string;
  senderShopId: string;
  city?: string;
  radiusMeters: number;
  eligibleShopIds: string[];
  rejected: AlertFilterRejection[];
  skippedBroadcast?: boolean;
}
