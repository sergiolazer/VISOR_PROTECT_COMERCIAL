import type { FeedEventItem } from '@visor-protect/shared';
import type { EventLogRecord } from '../../../../domain/entities/EventLog';
import type { IEventLogDocument } from '../models/EventLog.model';

export function mapEventLogDocumentToRecord(doc: IEventLogDocument | Record<string, unknown>): EventLogRecord {
  const d = doc as IEventLogDocument;
  const [lng, lat] = d.location?.coordinates ?? [undefined, undefined];

  return {
    id: String(d._id),
    eventType: d.type,
    city: d.city,
    senderShopId: d.shop_id,
    senderShopName: d.sender_shop_name,
    description: d.description,
    category: d.category as EventLogRecord['category'],
    location: lat != null && lng != null ? { lat, lng } : undefined,
    alertType: d.alert_type as EventLogRecord['alertType'],
    urgencyLevel: d.urgency_level as EventLogRecord['urgencyLevel'],
    iconType: d.icon_type as EventLogRecord['iconType'],
    confirmationCount: d.confirmation_count ?? 0,
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt),
  };
}

export function mapEventLogRecordToFeedItem(
  record: EventLogRecord,
  confirmedByShop: boolean,
): FeedEventItem {
  return {
    id: record.id,
    event_type: record.eventType,
    city: record.city,
    sender_shop_id: record.senderShopId,
    sender_shop_name: record.senderShopName,
    description: record.description,
    category: record.category,
    location: record.location,
    alert_type: record.alertType,
    urgency_level: record.urgencyLevel,
    icon_type: record.iconType,
    confirmation_count: record.confirmationCount,
    confirmed_by_shop: confirmedByShop,
    created_at: record.createdAt.toISOString(),
  };
}
