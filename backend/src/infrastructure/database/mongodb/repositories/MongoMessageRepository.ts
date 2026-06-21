import type { IMessageRepository } from '../../../../domain/repositories/IMessageRepository';
import type { CreateMessageParams, MessageRecord } from '../../../../domain/entities/Message';
import { MessageModel } from '../models/Message.model';
import { mapMessageDocumentToRecord } from '../mappers/chatMapper';
import { MongoExportMessageStream } from '../streams/MongoExportMessageStream';

export class MongoMessageRepository implements IMessageRepository {
  async create(params: CreateMessageParams): Promise<MessageRecord> {
    const doc = await MessageModel.create({
      _id: params.id,
      conversation_id: params.conversationId,
      sender_shop_id: params.senderShopId,
      sender_shop_name: params.senderShopName,
      message_type: params.type,
      content: params.content ?? null,
      image_url: params.imageUrl ?? null,
      read_by: [params.senderShopId],
    });

    return mapMessageDocumentToRecord(doc);
  }

  async findByConversation(conversationId: string, limit: number): Promise<MessageRecord[]> {
    const docs = await MessageModel.find({ conversation_id: conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.reverse().map((doc) => mapMessageDocumentToRecord(doc));
  }

  async findById(messageId: string): Promise<MessageRecord | null> {
    const doc = await MessageModel.findById(messageId).lean();
    return doc ? mapMessageDocumentToRecord(doc) : null;
  }

  async markAsRead(messageId: string, shopId: string): Promise<MessageRecord | null> {
    const doc = await MessageModel.findById(messageId);
    if (!doc) {
      return null;
    }

    if (!doc.read_by.includes(shopId)) {
      doc.read_by.push(shopId);
      await doc.save();
    }

    return mapMessageDocumentToRecord(doc);
  }

  async hasMessagesInConversations(conversationIds: string[]): Promise<boolean> {
    if (conversationIds.length === 0) {
      return false;
    }

    const exists = await MessageModel.exists({
      conversation_id: { $in: conversationIds },
    });

    return exists != null;
  }

  createExportStream(conversationIds: string[]) {
    return new MongoExportMessageStream(conversationIds);
  }
}
