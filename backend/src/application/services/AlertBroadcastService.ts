import {
  ALERT_RADIUS_METERS,
  CRITICAL_ALERT_RADIUS_METERS,
  SOCKET_EVENTS,
  type AlertBroadcastFilterAudit,
  type AlertPushNotificationDto,
  type AlertSeverity,
  type FeedEventItem,
} from '@visor-protect/shared';
import type { AlertEventRecord } from '../../domain/entities/AlertEvent';
import type { AlertRecipientRecord } from '../../domain/entities/AlertRecipient';
import type { IAlertRecipientRepository } from '../../domain/repositories/IAlertRecipientRepository';
import type {
  AlertBroadcastOptions,
  AlertBroadcastResult,
  IAlertBroadcastService,
} from '../../domain/services/IAlertBroadcastService';
import type { IAlertDispatchService } from '../../domain/services/IAlertDispatchService';
import type { IAlertFilterTelemetry } from '../../domain/services/IAlertFilterTelemetry';

export class AlertBroadcastService implements IAlertBroadcastService {
  constructor(
    private readonly recipientRepository: IAlertRecipientRepository,
    private readonly alertDispatchService: IAlertDispatchService,
    private readonly filterTelemetry: IAlertFilterTelemetry,
  ) {}

  async broadcast(
    event: AlertEventRecord,
    options?: AlertBroadcastOptions,
  ): Promise<AlertBroadcastResult> {
    const radiusMeters = this.resolveBroadcastRadius(event.severity);

    const { eligible: recipients, rejected } =
      await this.recipientRepository.resolveRecipientsWithAudit({
        lng: event.location.lng,
        lat: event.location.lat,
        radiusMeters,
        eventType: event.type,
        severity: event.severity,
        excludeShopId: event.shopId,
        city: event.city,
      });

    const filterAudit: AlertBroadcastFilterAudit = {
      eventId: event.id,
      eventType: event.type,
      severity: event.severity,
      senderShopId: event.shopId,
      city: event.city,
      radiusMeters,
      eligibleShopIds: recipients.map((recipient) => recipient.shopId),
      rejected,
      skippedBroadcast: options?.skipBroadcast ?? false,
    };

    await this.filterTelemetry.recordBroadcastAudit(filterAudit);

    if (!options?.skipBroadcast && recipients.length > 0) {
      await this.dispatchToRecipients(event, recipients, radiusMeters, options);
    }

    return {
      eventId: event.id,
      recipientCount: recipients.length,
      recipients,
      filterAudit,
    };
  }

  private async dispatchToRecipients(
    event: AlertEventRecord,
    recipients: AlertRecipientRecord[],
    radiusMeters: number,
    options?: AlertBroadcastOptions,
  ): Promise<void> {
    const deliveries = recipients.map((recipient) => ({
      shopId: recipient.shopId,
      payload: this.buildPushDto(event, recipient.distanceMeters),
    }));

    await this.alertDispatchService.dispatchPersonalized({
      eventId: event.id,
      socketEvent: SOCKET_EVENTS.ALERT_PUSH,
      deliveries,
      lat: event.location.lat,
      lng: event.location.lng,
      radiusMeters,
      excludeSocketId: options?.excludeSocketId,
    });

    if (options?.legacyFeedItem) {
      const legacyFeedItem = options.legacyFeedItem;
      await this.alertDispatchService.dispatchPersonalized({
        eventId: event.id,
        socketEvent: SOCKET_EVENTS.PANIC_ALERTS,
        deliveries: recipients.map((recipient) => ({
          shopId: recipient.shopId,
          payload: legacyFeedItem,
        })),
        lat: event.location.lat,
        lng: event.location.lng,
        radiusMeters,
        excludeSocketId: options.excludeSocketId,
      });
    }

    if (options?.feedItem) {
      await this.dispatchFeedEvents(event, recipients, options.feedItem, radiusMeters, options.excludeSocketId);
    }
  }

  private resolveBroadcastRadius(severity: AlertSeverity): number {
    if (severity === 'CRITICA') {
      return CRITICAL_ALERT_RADIUS_METERS;
    }
    return ALERT_RADIUS_METERS;
  }

  private buildPushDto(event: AlertEventRecord, distanceMeters: number): AlertPushNotificationDto {
    return {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      distance: distanceMeters,
      senderName: event.senderShopName,
      message: event.description,
      timestamp: event.createdAt.toISOString(),
    };
  }

  private async dispatchFeedEvents(
    event: AlertEventRecord,
    recipients: AlertRecipientRecord[],
    feedItem: FeedEventItem,
    radiusMeters: number,
    excludeSocketId?: string,
  ): Promise<void> {
    const deliveries = recipients.map((recipient) => ({
      shopId: recipient.shopId,
      payload: feedItem,
    }));

    const base = {
      eventId: event.id,
      lat: event.location.lat,
      lng: event.location.lng,
      radiusMeters,
      excludeSocketId,
      deliveries,
    };

    await this.alertDispatchService.dispatchPersonalized({
      ...base,
      socketEvent: SOCKET_EVENTS.FEED_UPDATES,
    });

    await this.alertDispatchService.dispatchPersonalized({
      ...base,
      socketEvent: SOCKET_EVENTS.REPORT_CREATED,
    });
  }
}
