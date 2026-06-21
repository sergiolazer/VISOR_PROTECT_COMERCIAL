import type {
  AlertFilterRejection,
  AlertFilterRejectionReason,
} from '@visor-protect/shared';

export interface AlertRecipientRecord {
  shopId: string;
  shopName: string;
  city: string;
  distanceMeters: number;
  subscribedEventTypes: string[];
}

export interface FindEligibleRecipientsParams {
  lng: number;
  lat: number;
  radiusMeters: number;
  eventType: string;
  severity: string;
  excludeShopId: string;
  city?: string;
}

export interface RecipientResolutionResult {
  eligible: AlertRecipientRecord[];
  rejected: AlertFilterRejection[];
  inRadiusCount: number;
}

export interface ExplainShopFilterParams extends FindEligibleRecipientsParams {
  targetShopId: string;
}
