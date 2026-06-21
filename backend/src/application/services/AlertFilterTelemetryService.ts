import { randomUUID } from 'node:crypto';
import type { AlertBroadcastFilterAudit, AlertFilterRejection } from '@visor-protect/shared';
import type { IAlertFilterTelemetry } from '../../domain/services/IAlertFilterTelemetry';
import { env } from '../../config/env';
import { AlertFilterLogModel } from '../../infrastructure/database/mongodb/models/AlertFilterLog.model';

export class AlertFilterTelemetryService implements IAlertFilterTelemetry {
  async recordBroadcastAudit(audit: AlertBroadcastFilterAudit): Promise<void> {
    const payload = {
      eventId: audit.eventId,
      eventType: audit.eventType,
      severity: audit.severity,
      senderShopId: audit.senderShopId,
      city: audit.city,
      radiusMeters: audit.radiusMeters,
      eligibleCount: audit.eligibleShopIds.length,
      rejectedCount: audit.rejected.length,
      rejectedByReason: this.countByReason(audit.rejected),
      skippedBroadcast: audit.skippedBroadcast ?? false,
    };

    if (env.alertFilterTelemetryDebug) {
      console.debug('[AlertFilterTelemetry] broadcast_audit', JSON.stringify(payload));

      for (const rejection of audit.rejected) {
        console.debug(
          '[AlertFilterTelemetry] rejection',
          JSON.stringify({
            eventId: audit.eventId,
            shopId: rejection.shopId,
            shopName: rejection.shopName,
            reason: rejection.reason,
            eventType: rejection.eventType,
            distanceMeters: rejection.distanceMeters,
            radiusMeters: rejection.radiusMeters ?? audit.radiusMeters,
            subscribedEventTypes: rejection.subscribedEventTypes,
          }),
        );
      }
    }

    if (!env.alertFilterTelemetryPersist || audit.rejected.length === 0) {
      return;
    }

    await AlertFilterLogModel.insertMany(
      audit.rejected.map((rejection) => ({
        _id: randomUUID(),
        event_id: audit.eventId,
        event_type: audit.eventType,
        severity: audit.severity,
        sender_shop_id: audit.senderShopId,
        shop_id: rejection.shopId,
        shop_name: rejection.shopName,
        reason: rejection.reason,
        distance_meters: rejection.distanceMeters,
        radius_meters: rejection.radiusMeters ?? audit.radiusMeters,
        subscribed_event_types: rejection.subscribedEventTypes,
        createdAt: new Date(),
      })),
      { ordered: false },
    );
  }

  async explainForShop(
    eventId: string,
    shopId: string,
    rejection: AlertFilterRejection | null,
  ): Promise<void> {
    if (!env.alertFilterTelemetryDebug) {
      return;
    }

    if (!rejection) {
      console.debug(
        '[AlertFilterTelemetry] explain',
        JSON.stringify({ eventId, shopId, result: 'ELIGIBLE' }),
      );
      return;
    }

    console.debug(
      '[AlertFilterTelemetry] explain',
      JSON.stringify({ eventId, result: 'REJECTED', ...rejection }),
    );
  }

  private countByReason(rejected: AlertFilterRejection[]): Record<string, number> {
    return rejected.reduce<Record<string, number>>((acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {});
  }
}
