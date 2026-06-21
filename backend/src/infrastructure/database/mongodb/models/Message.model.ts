import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { CHAT_MESSAGE_RETENTION_SECONDS } from '@visor-protect/shared';

export type MessageKind = 'text' | 'image';

export interface IMessageDocument extends Omit<Document, '_id'> {
  _id: string;
  conversation_id: string;
  sender_shop_id: string;
  sender_shop_name: string;
  message_type: MessageKind;
  content?: string | null;
  image_url?: string | null;
  read_by: string[];
  /** Fecha de creación — usada por el índice TTL para borrado automático. */
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    _id: { type: String, required: true },
    conversation_id: { type: String, ref: 'Conversation', required: true, index: true },
    sender_shop_id: { type: String, ref: 'Shop', required: true, index: true },
    sender_shop_name: { type: String, required: true },
    message_type: { type: String, enum: ['text', 'image'], required: true, default: 'text' },
    content: { type: String, default: null, trim: true, maxlength: 2000 },
    image_url: { type: String, default: null },
    read_by: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: 'messages',
  },
);

MessageSchema.index({ conversation_id: 1, createdAt: -1 });

/**
 * TTL index: MongoDB elimina el documento cuando
 * createdAt + expireAfterSeconds < now.
 * Sin cron jobs — el motor de MongoDB ejecuta el monitor TTL (~cada 60 s).
 */
MessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: CHAT_MESSAGE_RETENTION_SECONDS },
);

export const MessageModel: Model<IMessageDocument> =
  mongoose.models.Message ?? mongoose.model<IMessageDocument>('Message', MessageSchema);
