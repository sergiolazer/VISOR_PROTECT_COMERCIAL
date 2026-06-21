import type {
  AlertType,
  GeoLocation,
  QuickReportCategory,
  ReelIconType,
  UrgencyLevel,
} from '@visor-protect/shared';

export interface EventLogRecord {
  id: string;
  eventType: 'REEL_REPORT' | 'PANIC_ALERT';
  city: string;
  senderShopId: string;
  senderShopName: string;
  description: string;
  category?: QuickReportCategory;
  location?: GeoLocation;
  alertType?: AlertType;
  urgencyLevel?: UrgencyLevel;
  iconType: ReelIconType;
  confirmationCount: number;
  createdAt: Date;
}

export interface CreateEventLogParams {
  id: string;
  eventType: 'REEL_REPORT' | 'PANIC_ALERT';
  city: string;
  senderShopId: string;
  senderShopName: string;
  description: string;
  category?: QuickReportCategory;
  location?: GeoLocation;
  alertType?: AlertType;
  urgencyLevel?: UrgencyLevel;
  iconType?: ReelIconType;
}