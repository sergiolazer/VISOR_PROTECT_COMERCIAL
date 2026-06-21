import type { AlertEventRecord, CreateAlertEventRecordInput } from '../../../../domain/entities/AlertEvent';
import type { IAlertEventDocument } from '../models/AlertEvent.model';

export function mapAlertEventDocumentToRecord(
  doc: IAlertEventDocument | Record<string, unknown>,
): AlertEventRecord {
  const record = doc as Record<string, unknown>;
  const location = record.location as { coordinates: [number, number] };
  const coordinates = location.coordinates;

  return {
    id: String(record._id),
    shopId: String(record.shop_id),
    senderShopName: String(record.sender_shop_name),
    city: String(record.city),
    type: record.type as AlertEventRecord['type'],
    severity: record.severity as AlertEventRecord['severity'],
    location: { lat: coordinates[1], lng: coordinates[0] },
    description: String(record.description),
    metadata: (record.metadata ?? {}) as AlertEventRecord['metadata'],
    createdAt: record.createdAt as Date,
  };
}

export function mapCreateInputToDocument(input: CreateAlertEventRecordInput) {
  return {
    _id: input.id,
    shop_id: input.shopId,
    sender_shop_name: input.senderShopName,
    city: input.city,
    type: input.type,
    severity: input.severity,
    location: {
      type: 'Point' as const,
      coordinates: [input.location.lng, input.location.lat] as [number, number],
    },
    description: input.description,
    metadata: input.metadata,
  };
}
