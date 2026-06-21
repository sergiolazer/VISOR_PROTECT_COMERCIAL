import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IAuditLogDocument extends Omit<Document, '_id'> {
  _id: string;
  shop_id: string;
  user_id: string;
  action: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    _id: { type: String, required: true },
    shop_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  },
);

AuditLogSchema.index({ shop_id: 1, action: 1, createdAt: -1 });

export const AuditLogModel: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
