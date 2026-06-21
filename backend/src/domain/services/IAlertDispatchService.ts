import type { AlertGeofence, UrgencyLevel } from '@visor-protect/shared';

export interface GeofencedDispatchInput {
  eventId: string;
  socketEvent: string;
  payload: unknown;
  lat: number;
  lng: number;
  senderShopId: string;
  city?: string;
  urgencyLevel?: UrgencyLevel;
  excludeSocketId?: string;
}

export interface PersonalizedDispatchInput {
  eventId: string;
  socketEvent: string;
  deliveries: Array<{ shopId: string; payload: unknown }>;
  lat: number;
  lng: number;
  radiusMeters: number;
  excludeSocketId?: string;
}

export interface GeofencedDispatchResult {
  eligibleShopCount: number;
  recipientShopIds: string[];
  geofence: AlertGeofence;
}

export interface IAlertDispatchService {
  dispatchToGeofence(input: GeofencedDispatchInput): Promise<GeofencedDispatchResult>;
  dispatchPersonalized(input: PersonalizedDispatchInput): Promise<{ deliveredTargets: number }>;
}
