import type { AlertPushNotificationDto, AlertType, FeedEventItem } from '@visor-protect/shared';
import { mapSeverityToLegacyUrgency, isLegacyAlertType } from '@visor-protect/shared';

export function alertPushToFeedItem(dto: AlertPushNotificationDto): FeedEventItem {
  const alertType: AlertType = isLegacyAlertType(dto.type) ? dto.type : 'SOSPECHOSO';

  return {
    id: dto.eventId,
    event_type: 'PANIC_ALERT',
    city: '',
    sender_shop_id: '',
    sender_shop_name: dto.senderName,
    description: dto.message,
    alert_type: alertType,
    urgency_level: mapSeverityToLegacyUrgency(dto.severity),
    icon_type: 'suspicious',
    confirmation_count: 0,
    confirmed_by_shop: false,
    created_at: dto.timestamp,
  };
}

export function shouldShowPanicOverlay(dto: AlertPushNotificationDto): boolean {
  return dto.severity === 'CRITICA' || dto.type === 'ROBO' || dto.type === 'EMERGENCIA';
}
