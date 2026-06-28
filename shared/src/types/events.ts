import type { AlertType, GeoLocation, UrgencyLevel } from './alert';

export const EVENT_TYPES = ['REEL_REPORT', 'PANIC_ALERT'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const REEL_ICON_TYPES = ['info', 'suspicious', 'theft', 'accident'] as const;
export type ReelIconType = (typeof REEL_ICON_TYPES)[number];

export const QUICK_REPORT_CATEGORIES = [
  'SUSPICIOUS_PERSON',
  'VEHICLE',
  'MINOR_INCIDENT',
  'SECURITY_REPORT',
] as const;
export type QuickReportCategory = (typeof QUICK_REPORT_CATEGORIES)[number];

export const QUICK_REPORT_LABELS: Record<QuickReportCategory, string> = {
  SUSPICIOUS_PERSON: 'Persona sospechosa',
  VEHICLE: 'Vehículo',
  MINOR_INCIDENT: 'Incidente menor',
  SECURITY_REPORT: 'Reporte de seguridad',
};

export const FEED_RETENTION_HOURS = 2;

export interface QuickReportPayload {
  category: QuickReportCategory;
  lat: number;
  lng: number;
}

export interface ReelReportPayload {
  event_id: string;
  sender_shop_id: string;
  sender_shop_name: string;
  city: string;
  description: string;
  location?: GeoLocation;
  icon_type?: ReelIconType;
  timestamp: string;
}

export interface PanicAlertPayload {
  event_id: string;
  sender_shop_id: string;
  sender_shop_name: string;
  city: string;
  location: GeoLocation;
  alert_type: AlertType;
  urgency_level: UrgencyLevel;
  description?: string;
  timestamp: string;
}

export interface FeedEventItem {
  id: string;
  event_type: EventType;
  city: string;
  sender_shop_id: string;
  sender_shop_name: string;
  description: string;
  category?: QuickReportCategory;
  location?: GeoLocation;
  alert_type?: AlertType;
  urgency_level?: UrgencyLevel;
  icon_type: ReelIconType;
  confirmation_count: number;
  confirmed_by_shop: boolean;
  created_at: string;
}

export const SOCKET_EVENTS = {
  EMERGENCY_ALERT: 'emergency_alert',
  NEW_ALERT: 'new_alert',
  JOIN_CITY: 'join_city',
  CITY_JOINED: 'city_joined',
  SHOP_REGISTER: 'shop_register',
  SHOP_REGISTERED: 'shop_registered',
  ALERT_ACK: 'alert_ack',
  ERROR: 'error',

  REEL_REPORT: 'reel_report',
  REEL_REPORT_ACK: 'reel_report_ack',
  QUICK_REPORT: 'quick_report',
  NEW_REPORT: 'new_report',
  REPORT_CREATED: 'report_created',
  PANIC_ALERT: 'panic_alert',
  PANIC_ALERT_ACK: 'panic_alert_ack',
  FEED_UPDATES: 'feed_updates',
  PANIC_ALERTS: 'panic_alerts',
  FEED_HISTORY: 'feed_history',
  CONFIRM_REPORT: 'confirm_report',
  REPORT_CONFIRMED: 'report_confirmed',

  JOIN_CONVERSATION: 'join_conversation',
  CONVERSATION_JOINED: 'conversation_joined',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MESSAGE_SEEN: 'message_seen',
  MESSAGE_READ: 'message_read',

  CREATE_ALERT_EVENT: 'create_alert_event',
  ALERT_EVENT_ACK: 'alert_event_ack',
  ALERT_PUSH: 'alert_push',

  NETWORK_SNAPSHOT: 'network_snapshot',
  NETWORK_PRESENCE: 'network_presence',
} as const;

export { ALERT_RADIUS_METERS, CRITICAL_ALERT_RADIUS_METERS } from '../constants/alertDispatch';
export const CITY_ROOM_PREFIX = 'city:';

export type { AlertType, UrgencyLevel, GeoLocation, EmergencyAlertPayload, NewAlertPayload } from './alert';
export { ALERT_TYPES, URGENCY_LEVELS } from './alert';
