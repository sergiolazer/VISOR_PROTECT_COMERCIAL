export const ALERT_TYPES = ['ROBO', 'ACCIDENTE', 'SOSPECHOSO'] as const;
export const URGENCY_LEVELS = ['CRITICAL', 'WARNING'] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export interface GeoLocation {
  lat: number;
  lng: number;
}

/** @deprecated Usar PanicAlertPayload y evento panic_alert */
export interface EmergencyAlertPayload {
  event_id: string;
  sender_shop_id: string;
  sender_shop_name: string;
  city: string;
  location: GeoLocation;
  alert_type: AlertType;
  urgency_level: UrgencyLevel;
  timestamp: string;
}

/** @deprecated Usar FeedEventItem vía feed_updates */
export type NewAlertPayload = EmergencyAlertPayload;
