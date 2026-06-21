import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ConversationType = 'DIRECT' | 'GROUP';

interface ILastMessage {
  content: string;
  sender_shop_id: string;
  sender_shop_name: string;
  created_at: Date;
  message_type?: 'text' | 'image';
}

export interface IConversationDocument extends Omit<Document, '_id'> {
  _id: string;
  participants: string[];
  type: ConversationType;
  last_message?: ILastMessage;
  createdAt: Date;
  updatedAt: Date;
}

const LastMessageSchema = new Schema<ILastMessage>(
  {
    content: { type: String, required: true },
    sender_shop_id: { type: String, required: true },
    sender_shop_name: { type: String, required: true },
    created_at: { type: Date, required: true },
    message_type: { type: String, enum: ['text', 'image'], default: 'text' },
  },
  { _id: false },
);

const ConversationSchema = new Schema<IConversationDocument>(
  {
    _id: { type: String, required: true },
    participants: { type: [String], required: true, index: true },
    type: { type: String, enum: ['DIRECT', 'GROUP'], required: true },
    last_message: { type: LastMessageSchema, default: null },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, participants: 1 });

export const ConversationModel: Model<IConversationDocument> =
  mongoose.models.Conversation ??
  mongoose.model<IConversationDocument>('Conversation', ConversationSchema);
