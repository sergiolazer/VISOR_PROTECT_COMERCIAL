import type { AlertEventMetadata, AlertEventType, AlertSeverity } from '@visor-protect/shared';

export interface AlertEventRecord {
  id: string;
  shopId: string;
  senderShopName: string;
  city: string;
  type: AlertEventType;
  severity: AlertSeverity;
  location: { lat: number; lng: number };
  description: string;
  metadata: AlertEventMetadata;
  createdAt: Date;
}

export interface CreateAlertEventRecordInput {
  id: string;
  shopId: string;
  senderShopName: string;
  city: string;
  type: AlertEventType;
  severity: AlertSeverity;
  location: { lat: number; lng: number };
  description: string;
  metadata: AlertEventMetadata;
}
