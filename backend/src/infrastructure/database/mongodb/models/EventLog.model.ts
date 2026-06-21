import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type EventLogType = 'REEL_REPORT' | 'PANIC_ALERT';
export type EventLogStatus = 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';

interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface IEventLogDocument extends Omit<Document, '_id'> {
  _id: string;
  shop_id: string;
  sender_shop_name: string;
  city: string;
  type: EventLogType;
  category?: string;
  status: EventLogStatus;
  description: string;
  location?: IGeoPoint;
  alert_type?: string;
  urgency_level?: string;
  icon_type: string;
  confirmed_by: string[];
  confirmation_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventLogSchema = new Schema<IEventLogDocument>(
  {
    _id: { type: String, required: true },
    shop_id: { type: String, ref: 'Shop', required: true, index: true },
    sender_shop_name: { type: String, required: true },
    city: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      enum: ['REEL_REPORT', 'PANIC_ALERT'],
      required: true,
      index: true,
    },
    category: { type: String, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    description: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    alert_type: { type: String, default: null },
    urgency_level: { type: String, default: null },
    icon_type: { type: String, default: 'info' },
    confirmed_by: { type: [String], default: [] },
    confirmation_count: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'event_logs',
  },
);

EventLogSchema.index({ city: 1, createdAt: -1 });
EventLogSchema.index({ city: 1, type: 1, createdAt: -1 });
EventLogSchema.index({ location: '2dsphere' });

export const EventLogModel: Model<IEventLogDocument> =
  mongoose.models.EventLog ?? mongoose.model<IEventLogDocument>('EventLog', EventLogSchema);
