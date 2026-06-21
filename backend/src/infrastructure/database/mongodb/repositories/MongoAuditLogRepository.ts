import type { IAuditLogRepository } from '../../../../domain/repositories/IAuditLogRepository';
import type { AuditLogRecord, CreateAuditLogParams } from '../../../../domain/entities/AuditLog';
import { AuditLogModel } from '../models/AuditLog.model';

export class MongoAuditLogRepository implements IAuditLogRepository {
  async create(params: CreateAuditLogParams): Promise<AuditLogRecord> {
    const doc = await AuditLogModel.create({
      _id: params.id,
      shop_id: params.shopId,
      user_id: params.userId,
      action: params.action,
      metadata: params.metadata ?? null,
    });

    return {
      id: doc._id,
      shopId: doc.shop_id,
      userId: doc.user_id,
      action: doc.action as AuditLogRecord['action'],
      metadata: doc.metadata,
      createdAt: doc.createdAt,
    };
  }
}
