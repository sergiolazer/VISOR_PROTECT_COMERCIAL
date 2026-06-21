import type { AuditLogRecord, CreateAuditLogParams } from '../entities/AuditLog';

export interface IAuditLogRepository {
  create(params: CreateAuditLogParams): Promise<AuditLogRecord>;
}
