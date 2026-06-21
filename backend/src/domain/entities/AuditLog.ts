export type AuditAction =
  | 'EXPORT_CHAT'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'LEGACY_ALERT_REPLAY';

export interface AuditLogRecord {
  id: string;
  shopId: string;
  userId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAuditLogParams {
  id: string;
  shopId: string;
  userId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}
