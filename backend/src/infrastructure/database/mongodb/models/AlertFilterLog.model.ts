import mongoose, { Schema, type Model } from 'mongoose';
import type { AlertFilterRejectionReason } from '@visor-protect/shared';

export interface IAlertFilterLogDocument {
  _id: string;
  event_id: string;
  event_type: string;
  severity: string;
  sender_shop_id: string;
  shop_id: string;
  shop_name?: string;
  reason: AlertFilterRejectionReason;
  distance_meters?: number;
  radius_meters: number;
  subscribed_event_types?: string[];
  createdAt: Date;
}

const AlertFilterLogSchema = new Schema<IAlertFilterLogDocument>(
  {
    _id: { type: String, required: true },
    event_id: { type: String, required: true, index: true },
    event_type: { type: String, required: true },
    severity: { type: String, required: true },
    sender_shop_id: { type: String, required: true },
    shop_id: { type: String, required: true, index: true },
    shop_name: { type: String },
    reason: { type: String, required: true, index: true },
    distance_meters: { type: Number },
    radius_meters: { type: Number, required: true },
    subscribed_event_types: { type: [String], default: undefined },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'alert_filter_logs',
  },
);

AlertFilterLogSchema.index({ shop_id: 1, createdAt: -1 });
AlertFilterLogSchema.index({ event_id: 1, shop_id: 1 });

export const AlertFilterLogModel: Model<IAlertFilterLogDocument> =
  mongoose.models.AlertFilterLog ??
  mongoose.model<IAlertFilterLogDocument>('AlertFilterLog', AlertFilterLogSchema);
