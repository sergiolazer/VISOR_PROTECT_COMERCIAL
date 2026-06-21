import { randomUUID } from 'node:crypto';
import {
  FeedEventItem,
  ReelReportPayload,
  QuickReportPayload,
  SOCKET_EVENTS,
  getCategoryIconType,
  getQuickReportDescription,
} from '@visor-protect/shared';
import type { ICityRoomService } from '../../domain/services/ICityRoomService';
import type { IAlertDispatchService } from '../../domain/services/IAlertDispatchService';
import type { IEventLogRepository } from '../../domain/repositories/IEventLogRepository';
import type { EventLogRecord } from '../../domain/entities/EventLog';
import { AlertSenderValidator } from '../validators/AlertSenderValidator';
import { env } from '../../config/env';
import { mapEventLogRecordToFeedItem } from '../../infrastructure/database/mongodb/mappers/eventLogMapper';

export interface ProcessReelReportParams {
  report: ReelReportPayload;
  registeredShopId?: string;
}

export interface ProcessQuickReportParams {
  report: QuickReportPayload;
  registeredShopId?: string;
}

export interface ConfirmReportParams {
  eventId: string;
  shopId: string;
}

export class ReelService {
  constructor(
    private readonly eventLogRepository: IEventLogRepository,
    private readonly cityRoomService: ICityRoomService,
    private readonly alertDispatchService: IAlertDispatchService,
    private readonly alertSenderValidator: AlertSenderValidator,
  ) {}

  async processReelReport(params: ProcessReelReportParams): Promise<FeedEventItem> {
    const validated = await this.alertSenderValidator.validateReelReport({
      report: params.report,
      registeredShopId: params.registeredShopId,
    });

    const record = await this.eventLogRepository.create({
      id: validated.event_id,
      eventType: 'REEL_REPORT',
      city: validated.city,
      senderShopId: validated.sender_shop_id,
      senderShopName: validated.sender_shop_name,
      description: validated.description,
      location: validated.location,
      iconType: validated.icon_type ?? 'info',
    });

    const feedItem = mapEventLogRecordToFeedItem(record, false);
    await this.broadcastFeedItem(
      validated.city,
      feedItem,
      validated.location ?? { lat: 0, lng: 0 },
      validated.sender_shop_id,
    );
    return feedItem;
  }

  async processQuickReport(params: ProcessQuickReportParams): Promise<FeedEventItem> {
    const validated = await this.alertSenderValidator.validateQuickReport({
      report: params.report,
      registeredShopId: params.registeredShopId,
    });

    const record = await this.eventLogRepository.create({
      id: randomUUID(),
      eventType: 'REEL_REPORT',
      city: validated.city,
      senderShopId: validated.senderShopId,
      senderShopName: validated.senderShopName,
      description: getQuickReportDescription(validated.category),
      category: validated.category,
      location: validated.location,
      iconType: getCategoryIconType(validated.category),
    });

    const feedItem = mapEventLogRecordToFeedItem(record, false);
    await this.broadcastFeedItem(
      validated.city,
      feedItem,
      validated.location,
      validated.senderShopId,
    );
    return feedItem;
  }

  async getFeedHistory(city: string, shopId: string): Promise<FeedEventItem[]> {
    const records = await this.eventLogRepository.findRecentReelReportsByCity(
      city,
      env.feedHistoryLimit,
    );

    const confirmedIds = await this.eventLogRepository.getConfirmedEventIds(
      records.map((record) => record.id),
      shopId,
    );

    return records.map((record) => mapEventLogRecordToFeedItem(record, confirmedIds.has(record.id)));
  }

  async confirmReport(params: ConfirmReportParams): Promise<FeedEventItem> {
    const event = await this.eventLogRepository.findById(params.eventId);

    if (!event || event.eventType !== 'REEL_REPORT') {
      throw new Error('Reporte no encontrado');
    }

    const newCount = await this.eventLogRepository.addConfirmation(
      params.eventId,
      params.shopId,
    );

    const feedItem: FeedEventItem = {
      ...mapEventLogRecordToFeedItem(event, true),
      confirmation_count: newCount,
    };

    await this.cityRoomService.broadcastToCity(
      event.city,
      SOCKET_EVENTS.REPORT_CONFIRMED,
      feedItem,
    );

    return feedItem;
  }

  toFeedItem(record: EventLogRecord, confirmedByShop: boolean): FeedEventItem {
    return mapEventLogRecordToFeedItem(record, confirmedByShop);
  }

  private async broadcastFeedItem(
    city: string,
    feedItem: FeedEventItem,
    location: { lat: number; lng: number },
    senderShopId: string,
  ): Promise<void> {
    if (env.mongoChangeStream) {
      return;
    }

    await this.alertDispatchService.dispatchToGeofence({
      eventId: feedItem.id,
      socketEvent: SOCKET_EVENTS.FEED_UPDATES,
      payload: feedItem,
      lat: location.lat,
      lng: location.lng,
      senderShopId,
      city,
    });

    await this.alertDispatchService.dispatchToGeofence({
      eventId: feedItem.id,
      socketEvent: SOCKET_EVENTS.REPORT_CREATED,
      payload: feedItem,
      lat: location.lat,
      lng: location.lng,
      senderShopId,
      city,
    });
  }
}
