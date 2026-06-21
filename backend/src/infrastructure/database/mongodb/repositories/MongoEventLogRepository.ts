import type { IEventLogRepository } from '../../../../domain/repositories/IEventLogRepository';
import type { CreateEventLogParams, EventLogRecord } from '../../../../domain/entities/EventLog';
import { EventLogModel } from '../models/EventLog.model';
import { mapEventLogDocumentToRecord } from '../mappers/eventLogMapper';

export class MongoEventLogRepository implements IEventLogRepository {
  async create(params: CreateEventLogParams): Promise<EventLogRecord> {
    const doc = await EventLogModel.create({
      _id: params.id,
      shop_id: params.senderShopId,
      sender_shop_name: params.senderShopName,
      city: params.city,
      type: params.eventType,
      category: params.category ?? null,
      status: 'ACTIVE',
      description: params.description,
      location: params.location
        ? {
            type: 'Point',
            coordinates: [params.location.lng, params.location.lat],
          }
        : undefined,
      alert_type: params.alertType ?? null,
      urgency_level: params.urgencyLevel ?? null,
      icon_type: params.iconType ?? 'info',
      confirmed_by: [],
      confirmation_count: 0,
    });

    return mapEventLogDocumentToRecord(doc);
  }

  async findReelReportsByCity(city: string, hours: number): Promise<EventLogRecord[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const docs = await EventLogModel.find({
      city,
      type: 'REEL_REPORT',
      status: 'ACTIVE',
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .lean();

    return docs.map((doc) => mapEventLogDocumentToRecord(doc));
  }

  async findRecentReelReportsByCity(city: string, limit: number): Promise<EventLogRecord[]> {
    const docs = await EventLogModel.find({
      city,
      type: 'REEL_REPORT',
      status: 'ACTIVE',
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc) => mapEventLogDocumentToRecord(doc));
  }

  async findById(eventId: string): Promise<EventLogRecord | null> {
    const doc = await EventLogModel.findById(eventId).lean();
    return doc ? mapEventLogDocumentToRecord(doc) : null;
  }

  async addConfirmation(eventId: string, shopId: string): Promise<number> {
    const event = await EventLogModel.findById(eventId);

    if (!event) {
      return 0;
    }

    if (event.confirmed_by.includes(shopId)) {
      return event.confirmation_count;
    }

    event.confirmed_by.push(shopId);
    event.confirmation_count = event.confirmed_by.length;
    await event.save();

    return event.confirmation_count;
  }

  async hasConfirmation(eventId: string, shopId: string): Promise<boolean> {
    const event = await EventLogModel.findById(eventId).select('confirmed_by').lean();
    return event?.confirmed_by.includes(shopId) ?? false;
  }

  async getConfirmedEventIds(eventIds: string[], shopId: string): Promise<Set<string>> {
    if (eventIds.length === 0) {
      return new Set();
    }

    const events = await EventLogModel.find({
      _id: { $in: eventIds },
      confirmed_by: shopId,
    })
      .select('_id')
      .lean();

    return new Set(events.map((event) => event._id));
  }
}
