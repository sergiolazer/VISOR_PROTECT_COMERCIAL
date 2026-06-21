import { randomUUID } from 'node:crypto';
import type {
  AlertType,
  CreateAlertEventInput,
  FeedEventItem,
  QuickReportCategory,
  ReelIconType,
  UrgencyLevel,
} from '@visor-protect/shared';
import {
  getCategoryIconType,
  getQuickReportDescription,
  mapLegacyAlertType,
  mapLegacyUrgencyToSeverity,
  mapReportToAlertType,
  mapReportToSeverity,
  CRITICAL_ALERT_RADIUS_METERS,
  ALERT_RADIUS_METERS,
} from '@visor-protect/shared';
import { env } from '../../config/env';
import type { AlertEventRecord } from '../../domain/entities/AlertEvent';
import type { IAlertEventRepository } from '../../domain/repositories/IAlertEventRepository';
import type { IEventLogRepository } from '../../domain/repositories/IEventLogRepository';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import type { IAlertBroadcastService } from '../../domain/services/IAlertBroadcastService';
import type { IAlertFilterTelemetry } from '../../domain/services/IAlertFilterTelemetry';
import type { IAlertRecipientRepository } from '../../domain/repositories/IAlertRecipientRepository';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { AlertFilterRejection } from '@visor-protect/shared';
import { AlertValidationError, ALERT_ERROR_CODES } from '../../domain/errors/AlertValidationError';
import { mapEventLogRecordToFeedItem } from '../../infrastructure/database/mongodb/mappers/eventLogMapper';
import { AlertDescriptionValidator } from '../validators/AlertDescriptionValidator';
import type { SubscriptionService } from './SubscriptionService';

export interface AlertProcessingOptions {
  excludeSocketId?: string;
  /** Backfill histórico: solo persiste, sin push ni feed en tiempo real. */
  isLegacyReplay?: boolean;
}

export interface CreateAndBroadcastInput extends CreateAlertEventInput, AlertProcessingOptions {}

export interface CreateAndBroadcastResult {
  event: AlertEventRecord;
  recipientCount: number;
}

export interface LegacyEmergencyAlertInput extends AlertProcessingOptions {
  shopId: string;
  alertType: AlertType;
  urgencyLevel: UrgencyLevel;
  lat: number;
  lng: number;
  description?: string;
}

export interface LegacyEmergencyAlertResult {
  feedItem: FeedEventItem;
  alertEvent: AlertEventRecord;
  recipientCount: number;
}

export interface LegacyReportInput extends AlertProcessingOptions {
  shopId: string;
  lat: number;
  lng: number;
  description?: string;
  category?: QuickReportCategory;
  iconType?: ReelIconType;
}

export interface LegacyReportResult {
  feedItem: FeedEventItem;
  alertEvent: AlertEventRecord;
  recipientCount: number;
}

export class AlertService {
  constructor(
    private readonly alertEventRepository: IAlertEventRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly shopRepository: IShopRepository,
    private readonly alertBroadcastService: IAlertBroadcastService,
    private readonly recipientRepository: IAlertRecipientRepository,
    private readonly filterTelemetry: IAlertFilterTelemetry,
    private readonly descriptionValidator: AlertDescriptionValidator,
    private readonly subscriptionService: SubscriptionService,
    private readonly auditLogRepository?: IAuditLogRepository,
  ) {}

  async createAndBroadcast(input: CreateAndBroadcastInput): Promise<CreateAndBroadcastResult> {
    await this.subscriptionService.assertCanEmitAlerts(input.shopId);
    const shop = await this.requireShop(input.shopId);
    const description = this.descriptionValidator.validate(input.description);

    const event = await this.persistAlertEvent({
      shopId: input.shopId,
      senderShopName: shop.name,
      city: shop.city,
      type: input.type,
      severity: input.severity,
      lat: input.lat,
      lng: input.lng,
      description,
      metadata: input.metadata ?? { source: 'manual' },
      isLegacyReplay: input.isLegacyReplay,
    });

    const broadcast = await this.alertBroadcastService.broadcast(event, {
      excludeSocketId: input.excludeSocketId,
      skipBroadcast: input.isLegacyReplay,
    });

    return { event, recipientCount: broadcast.recipientCount };
  }

  /**
   * Unifica emergency_alert / panic_alert (legacy) con AlertEvent inmutable
   * y filtrado inteligente. Mantiene EventLog para el Safety Reel.
   */
  async processLegacyEmergencyAlert(
    input: LegacyEmergencyAlertInput,
  ): Promise<LegacyEmergencyAlertResult> {
    await this.subscriptionService.assertCanEmitAlerts(input.shopId);
    const shop = await this.requireShop(input.shopId);

    const rawDescription =
      input.description?.trim() ||
      `Alerta ${input.alertType} detectada en el comercio`;

    const description = this.descriptionValidator.validate(rawDescription);
    const eventLogId = randomUUID();

    const record = await this.eventLogRepository.create({
      id: eventLogId,
      eventType: 'PANIC_ALERT',
      city: shop.city,
      senderShopId: shop.id,
      senderShopName: shop.name,
      description,
      location: { lat: input.lat, lng: input.lng },
      alertType: input.alertType,
      urgencyLevel: input.urgencyLevel,
      iconType: 'suspicious',
    });

    const feedItem = mapEventLogRecordToFeedItem(record, false);
    const alertType = mapLegacyAlertType(input.alertType);
    const severity = mapLegacyUrgencyToSeverity(input.urgencyLevel);

    const alertEvent = await this.persistAlertEvent({
      shopId: shop.id,
      senderShopName: shop.name,
      city: shop.city,
      type: alertType,
      severity,
      lat: input.lat,
      lng: input.lng,
      description,
      metadata: {
        source: 'legacy',
        event_log_id: eventLogId,
        legacy_alert_type: input.alertType,
        legacy_urgency_level: input.urgencyLevel,
        ...(input.isLegacyReplay ? { is_legacy_replay: true } : {}),
      },
    });

    const broadcast = await this.alertBroadcastService.broadcast(alertEvent, {
      excludeSocketId: input.excludeSocketId,
      skipBroadcast: input.isLegacyReplay,
      legacyFeedItem: input.isLegacyReplay ? undefined : feedItem,
    });

    return {
      feedItem,
      alertEvent,
      recipientCount: broadcast.recipientCount,
    };
  }

  /**
   * Unifica new_report / quick_report / reel_report con AlertEvent inmutable
   * y filtrado por geocerca + subscribedEventTypes.
   */
  async processLegacyReport(input: LegacyReportInput): Promise<LegacyReportResult> {
    await this.subscriptionService.assertCanEmitAlerts(input.shopId);
    const shop = await this.requireShop(input.shopId);

    const rawDescription =
      input.description?.trim() ||
      (input.category ? getQuickReportDescription(input.category) : 'Reporte de seguridad');

    const description = this.descriptionValidator.validate(rawDescription);
    const eventLogId = randomUUID();
    const iconType = input.category
      ? getCategoryIconType(input.category)
      : (input.iconType ?? 'info');

    const record = await this.eventLogRepository.create({
      id: eventLogId,
      eventType: 'REEL_REPORT',
      city: shop.city,
      senderShopId: shop.id,
      senderShopName: shop.name,
      description,
      category: input.category,
      location: { lat: input.lat, lng: input.lng },
      iconType,
    });

    const feedItem = mapEventLogRecordToFeedItem(record, false);
    const alertType = mapReportToAlertType(input.category, iconType);
    const severity = mapReportToSeverity(input.category, iconType);

    const alertEvent = await this.persistAlertEvent({
      shopId: shop.id,
      senderShopName: shop.name,
      city: shop.city,
      type: alertType,
      severity,
      lat: input.lat,
      lng: input.lng,
      description,
      metadata: {
        source: 'legacy',
        event_log_id: eventLogId,
        report_category: input.category,
        icon_type: iconType,
        ...(input.isLegacyReplay ? { is_legacy_replay: true } : {}),
      },
    });

    let recipientCount = 0;

    if (input.isLegacyReplay) {
      const broadcast = await this.alertBroadcastService.broadcast(alertEvent, {
        skipBroadcast: true,
      });
      recipientCount = broadcast.recipientCount;
      await this.writeLegacyReplayAudit(shop.id, alertEvent.id, {
        event_log_id: eventLogId,
        alert_type: alertType,
        category: input.category,
      });
    } else if (!env.mongoChangeStream) {
      const broadcast = await this.alertBroadcastService.broadcast(alertEvent, {
        excludeSocketId: input.excludeSocketId,
        feedItem,
      });
      recipientCount = broadcast.recipientCount;
    }

    return { feedItem, alertEvent, recipientCount };
  }

  /** Usado por EventChangeStreamService cuando MONGODB_CHANGE_STREAM=true. */
  async broadcastReportFromEventLog(
    eventLogId: string,
    feedItem: FeedEventItem,
  ): Promise<number> {
    const alertEvent = await this.alertEventRepository.findByEventLogId(eventLogId);

    if (!alertEvent) {
      return 0;
    }

    const broadcast = await this.alertBroadcastService.broadcast(alertEvent, {
      feedItem,
    });

    return broadcast.recipientCount;
  }

  async getEventById(eventId: string): Promise<AlertEventRecord | null> {
    return this.alertEventRepository.findById(eventId);
  }

  /**
   * Diagnóstico de soporte: explica por qué un comercio no recibió un evento
   * (distancia, suscripción, ciudad, etc.).
   */
  async explainDeliveryForShop(
    eventId: string,
    targetShopId: string,
  ): Promise<AlertFilterRejection | null> {
    const event = await this.alertEventRepository.findById(eventId);
    if (!event) {
      throw new AlertValidationError('Evento no encontrado', ALERT_ERROR_CODES.INVALID_PAYLOAD);
    }

    const radiusMeters =
      event.severity === 'CRITICA' ? CRITICAL_ALERT_RADIUS_METERS : ALERT_RADIUS_METERS;

    const rejection = await this.recipientRepository.explainShopFilter({
      lng: event.location.lng,
      lat: event.location.lat,
      radiusMeters,
      eventType: event.type,
      severity: event.severity,
      excludeShopId: event.shopId,
      city: event.city,
      targetShopId,
    });

    await this.filterTelemetry.explainForShop(eventId, targetShopId, rejection);
    return rejection;
  }

  private async requireShop(shopId: string) {
    const shop = await this.shopRepository.findById(shopId);
    if (!shop) {
      throw new AlertValidationError('Comercio emisor no encontrado', ALERT_ERROR_CODES.SHOP_NOT_FOUND);
    }
    return shop;
  }

  private async persistAlertEvent(params: {
    shopId: string;
    senderShopName: string;
    city: string;
    type: CreateAlertEventInput['type'];
    severity: CreateAlertEventInput['severity'];
    lat: number;
    lng: number;
    description: string;
    metadata: CreateAlertEventInput['metadata'];
    isLegacyReplay?: boolean;
  }): Promise<AlertEventRecord> {
    return this.alertEventRepository.create({
      id: randomUUID(),
      shopId: params.shopId,
      senderShopName: params.senderShopName,
      city: params.city,
      type: params.type,
      severity: params.severity,
      location: { lat: params.lat, lng: params.lng },
      description: params.description,
      metadata: {
        ...(params.metadata ?? {}),
        ...(params.isLegacyReplay ? { is_legacy_replay: true } : {}),
      },
    });
  }

  private async writeLegacyReplayAudit(
    shopId: string,
    alertEventId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditLogRepository) {
      return;
    }

    await this.auditLogRepository.create({
      id: randomUUID(),
      shopId,
      userId: 'system:legacy_replay',
      action: 'LEGACY_ALERT_REPLAY',
      metadata: {
        alert_event_id: alertEventId,
        ...metadata,
      },
    });
  }
}
