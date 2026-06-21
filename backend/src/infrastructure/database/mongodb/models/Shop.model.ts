import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  ALERT_EVENT_TYPES,
  ALERT_RADIUS_METERS,
  SHOP_SUBSCRIPTION_STATUSES,
  createTrialSubscription,
} from '@visor-protect/shared';

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface IShopSubscriptionDocument {
  status: (typeof SHOP_SUBSCRIPTION_STATUSES)[number];
  trialEndsAt: Date;
  mercado_pago_preapproval_id?: string | null;
}

export interface IShopDocument extends Omit<Document, '_id'> {
  _id: string;
  name: string;
  address: string;
  city: string;
  location: IGeoPoint;
  owner_id: mongoose.Types.ObjectId;
  socket_id: string | null;
  subscribed_event_types: string[];
  alert_radius_meters: number;
  subscription: IShopSubscriptionDocument;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSubscriptionSchema = new Schema<IShopSubscriptionDocument>(
  {
    status: {
      type: String,
      enum: SHOP_SUBSCRIPTION_STATUSES,
      default: 'TRIAL',
      required: true,
    },
    trialEndsAt: {
      type: Date,
      required: true,
      default: () => createTrialSubscription().trialEndsAt,
    },
  },
  { _id: false },
);

const ShopSchema = new Schema<IShopDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    socket_id: { type: String, default: null },
    subscribed_event_types: {
      type: [String],
      enum: ALERT_EVENT_TYPES,
      default: () => [...ALERT_EVENT_TYPES],
    },
    alert_radius_meters: {
      type: Number,
      default: ALERT_RADIUS_METERS,
      min: 100,
      max: 5000,
    },
    subscription: {
      type: ShopSubscriptionSchema,
      default: () => createTrialSubscription(),
    },
  },
  {
    timestamps: true,
    collection: 'shops',
  },
);

ShopSchema.index({ location: '2dsphere' });
ShopSchema.index({ city: 1, name: 1 });
ShopSchema.index({ 'subscription.status': 1, 'subscription.trialEndsAt': 1 });

export const ShopModel: Model<IShopDocument> =
  mongoose.models.Shop ?? mongoose.model<IShopDocument>('Shop', ShopSchema);
