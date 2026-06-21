import type { FeedEventItem, PanicAlertPayload } from '@visor-protect/shared';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import type { IAlertDispatchService } from '../../domain/services/IAlertDispatchService';
import type { IEventLogRepository } from '../../domain/repositories/IEventLogRepository';
import { AlertSenderValidator } from '../validators/AlertSenderValidator';
import { mapEventLogRecordToFeedItem } from '../../infrastructure/database/mongodb/mappers/eventLogMapper';

export interface ProcessPanicAlertParams {
  alert: PanicAlertPayload;
  senderSocketId?: string;
  registeredShopId?: string;
}

export interface PanicAlertResult {
  eventId: string;
  recipientCount: number;
  city: string;
}

export class PanicAlertService {
  constructor(
    private readonly eventLogRepository: IEventLogRepository,
    private readonly alertDispatchService: IAlertDispatchService,
    private readonly alertSenderValidator: AlertSenderValidator,
  ) {}

  async processPanicAlert(params: ProcessPanicAlertParams): Promise<PanicAlertResult> {
    const validated = await this.alertSenderValidator.validatePanicAlert({
      alert: params.alert,
      registeredShopId: params.registeredShopId,
    });

    const description =
      validated.description ??
      `Alerta ${validated.alert_type} — ${validated.urgency_level}`;

    const record = await this.eventLogRepository.create({
      id: validated.event_id,
      eventType: 'PANIC_ALERT',
      city: validated.city,
      senderShopId: validated.sender_shop_id,
      senderShopName: validated.sender_shop_name,
      description,
      location: validated.location,
      alertType: validated.alert_type,
      urgencyLevel: validated.urgency_level,
      iconType: 'suspicious',
    });

    const panicPayload: FeedEventItem = {
      ...mapEventLogRecordToFeedItem(record, false),
      created_at: validated.timestamp,
    };

    const { eligibleShopCount } = await this.alertDispatchService.dispatchToGeofence({
      eventId: validated.event_id,
      socketEvent: SOCKET_EVENTS.PANIC_ALERTS,
      payload: panicPayload,
      lat: validated.location.lat,
      lng: validated.location.lng,
      senderShopId: validated.sender_shop_id,
      city: validated.city,
      urgencyLevel: validated.urgency_level,
      excludeSocketId: params.senderSocketId,
    });

    return {
      eventId: validated.event_id,
      recipientCount: eligibleShopCount,
      city: validated.city,
    };
  }
}
