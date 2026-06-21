import type { UrgencyLevel } from '../types/alert';

export const SHOP_ROOM_PREFIX = 'shop:';
export const REDIS_ALERT_CHANNEL = 'visor:alerts:dispatch';

export const ALERT_RADIUS_METERS = 500;
export const CRITICAL_ALERT_RADIUS_METERS = 1000;

export interface AlertGeofence {
  lat: number;
  lng: number;
  radius_meters: number;
}

export interface PersonalizedAlertDelivery {
  shop_id: string;
  payload: unknown;
}

export interface AlertDispatchMessage {
  event_id: string;
  socket_event: string;
  /** Broadcast uniforme (legacy). Omitir si se usa personalized_deliveries. */
  payload?: unknown;
  recipient_shop_ids?: string[];
  personalized_deliveries?: PersonalizedAlertDelivery[];
  exclude_socket_id?: string;
  origin_instance_id: string;
  geofence?: AlertGeofence;
  published_at: string;
}

export function getAlertRadiusMeters(urgencyLevel?: UrgencyLevel): number {
  if (urgencyLevel === 'CRITICAL') {
    return CRITICAL_ALERT_RADIUS_METERS;
  }
  return ALERT_RADIUS_METERS;
}
