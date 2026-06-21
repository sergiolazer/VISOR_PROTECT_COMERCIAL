import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type UserRole = 'OWNER' | 'ADMIN' | 'OPERATOR';

export interface IUserDocument extends Document {
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  shop_ids: string[];
  is_active: boolean;
  last_login_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['OWNER', 'ADMIN', 'OPERATOR'],
      default: 'OWNER',
    },
    shop_ids: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    last_login_at: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

UserSchema.index({ email: 1 });
UserSchema.index({ shop_ids: 1 });

export const UserModel: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', UserSchema);
