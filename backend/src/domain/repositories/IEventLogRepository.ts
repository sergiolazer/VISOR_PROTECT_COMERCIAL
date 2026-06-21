import type { EventLogRecord, CreateEventLogParams } from '../entities/EventLog';

export interface IEventLogRepository {
  create(params: CreateEventLogParams): Promise<EventLogRecord>;
  findReelReportsByCity(city: string, hours: number): Promise<EventLogRecord[]>;
  findRecentReelReportsByCity(city: string, limit: number): Promise<EventLogRecord[]>;
  findById(eventId: string): Promise<EventLogRecord | null>;
  addConfirmation(eventId: string, shopId: string): Promise<number>;
  hasConfirmation(eventId: string, shopId: string): Promise<boolean>;
  getConfirmedEventIds(eventIds: string[], shopId: string): Promise<Set<string>>;
}
