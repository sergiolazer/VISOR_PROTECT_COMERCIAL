import type { AlertEventRecord, CreateAlertEventRecordInput } from '../../../../domain/entities/AlertEvent';
import type {
  FindAlertEventsNearParams,
  IAlertEventRepository,
} from '../../../../domain/repositories/IAlertEventRepository';
import { AlertEventModel } from '../models/AlertEvent.model';
import {
  mapAlertEventDocumentToRecord,
  mapCreateInputToDocument,
} from '../mappers/alertEventMapper';

export class MongoAlertEventRepository implements IAlertEventRepository {
  async create(input: CreateAlertEventRecordInput): Promise<AlertEventRecord> {
    const document = await AlertEventModel.create(mapCreateInputToDocument(input));
    return mapAlertEventDocumentToRecord(document.toObject());
  }

  async findById(eventId: string): Promise<AlertEventRecord | null> {
    const document = await AlertEventModel.findById(eventId).lean();
    if (!document) {
      return null;
    }
    return mapAlertEventDocumentToRecord(document);
  }

  async findByEventLogId(eventLogId: string): Promise<AlertEventRecord | null> {
    const document = await AlertEventModel.findOne({
      'metadata.event_log_id': eventLogId,
    }).lean();

    if (!document) {
      return null;
    }

    return mapAlertEventDocumentToRecord(document);
  }

  async findNear(params: FindAlertEventsNearParams): Promise<AlertEventRecord[]> {
    const query: Record<string, unknown> = {
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [params.lng, params.lat] },
          $maxDistance: params.radiusMeters,
        },
      },
    };

    if (params.type) {
      query.type = params.type;
    }

    const documents = await AlertEventModel.find(query)
      .sort({ createdAt: -1 })
      .limit(params.limit ?? 50)
      .lean();

    return documents.map(mapAlertEventDocumentToRecord);
  }
}
