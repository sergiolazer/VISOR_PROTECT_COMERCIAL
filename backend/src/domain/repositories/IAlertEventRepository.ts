import type { AlertEventRecord, CreateAlertEventRecordInput } from '../entities/AlertEvent';

export interface FindAlertEventsNearParams {
  lng: number;
  lat: number;
  radiusMeters: number;
  type?: string;
  limit?: number;
}

/** Repositorio de solo escritura/lectura — eventos inmutables (sin update/delete). */
export interface IAlertEventRepository {
  create(input: CreateAlertEventRecordInput): Promise<AlertEventRecord>;
  findById(eventId: string): Promise<AlertEventRecord | null>;
  findByEventLogId(eventLogId: string): Promise<AlertEventRecord | null>;
  findNear(params: FindAlertEventsNearParams): Promise<AlertEventRecord[]>;
}
