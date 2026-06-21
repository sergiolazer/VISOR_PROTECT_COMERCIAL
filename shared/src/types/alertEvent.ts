export const ALERT_EVENT_TYPES = [
  'ROBO',
  'ACCIDENTE',
  'SOSPECHOSO',
  'INTRUSION',
  'VANDALISMO',
  'EMERGENCIA',
] as const;

export const ALERT_SEVERITIES = ['BAJA', 'MEDIA', 'CRITICA'] as const;

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export interface AlertEventGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface AlertEventMetadata {
  source?: 'manual' | 'sensor' | 'integration' | 'legacy';
  device_id?: string;
  zone?: string;
  event_log_id?: string;
  legacy_alert_type?: string;
  legacy_urgency_level?: string;
  report_category?: string;
  icon_type?: string;
  is_legacy_replay?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/** DTO compacto para push en tiempo real (optimizado para red). */
export interface AlertPushNotificationDto {
  eventId: string;
  type: AlertEventType;
  severity: AlertSeverity;
  distance: number;
  senderName: string;
  message: string;
  timestamp: string;
}

export interface CreateAlertEventInput {
  shopId: string;
  type: AlertEventType;
  severity: AlertSeverity;
  lat: number;
  lng: number;
  description: string;
  metadata?: AlertEventMetadata;
}
