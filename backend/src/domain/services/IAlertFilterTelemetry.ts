import type {
  AlertBroadcastFilterAudit,
  AlertFilterRejection,
} from '@visor-protect/shared';

export interface IAlertFilterTelemetry {
  recordBroadcastAudit(audit: AlertBroadcastFilterAudit): Promise<void>;
  explainForShop(
    eventId: string,
    shopId: string,
    rejection: AlertFilterRejection | null,
  ): Promise<void>;
}
