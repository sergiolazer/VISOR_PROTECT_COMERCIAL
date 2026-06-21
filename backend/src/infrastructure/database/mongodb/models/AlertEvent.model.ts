import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { ALERT_EVENT_TYPES, ALERT_SEVERITIES } from '@visor-protect/shared';

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Registro inmutable de alerta — Event-Driven Architecture.
 * Equivalente shell: db.alertEvents.createIndex({ location: "2dsphere", type: 1, createdAt: -1 })
 */
export interface IAlertEventDocument extends Omit<Document, '_id'> {
  _id: string;
  shop_id: string;
  sender_shop_name: string;
  city: string;
  type: (typeof ALERT_EVENT_TYPES)[number];
  severity: (typeof ALERT_SEVERITIES)[number];
  location: IGeoPoint;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const AlertEventSchema = new Schema<IAlertEventDocument>(
  {
    _id: { type: String, required: true },
    shop_id: { type: String, ref: 'Shop', required: true, index: true },
    sender_shop_name: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ALERT_EVENT_TYPES,
      required: true,
    },
    severity: {
      type: String,
      enum: ALERT_SEVERITIES,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    description: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'alert_events',
  },
);

AlertEventSchema.index({ location: '2dsphere', type: 1, createdAt: -1 });
AlertEventSchema.index({ shop_id: 1, createdAt: -1 });

export const AlertEventModel: Model<IAlertEventDocument> =
  mongoose.models.AlertEvent ??
  mongoose.model<IAlertEventDocument>('AlertEvent', AlertEventSchema);
