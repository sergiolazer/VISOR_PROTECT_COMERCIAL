import type { IConversationRepository } from '../../../../domain/repositories/IConversationRepository';
import type {
  ConversationRecord,
  CreateConversationParams,
  LastMessageRecord,
} from '../../../../domain/entities/Conversation';
import { ConversationModel } from '../models/Conversation.model';
import { mapConversationDocumentToRecord } from '../mappers/chatMapper';

export class MongoConversationRepository implements IConversationRepository {
  async create(params: CreateConversationParams): Promise<ConversationRecord> {
    const doc = await ConversationModel.create({
      _id: params.id,
      participants: params.participants,
      type: params.type,
    });

    return mapConversationDocumentToRecord(doc);
  }

  async findById(conversationId: string): Promise<ConversationRecord | null> {
    const doc = await ConversationModel.findById(conversationId).lean();
    return doc ? mapConversationDocumentToRecord(doc) : null;
  }

  async findDirectBetween(shopA: string, shopB: string): Promise<ConversationRecord | null> {
    const doc = await ConversationModel.findOne({
      type: 'DIRECT',
      participants: { $all: [shopA, shopB], $size: 2 },
    }).lean();

    return doc ? mapConversationDocumentToRecord(doc) : null;
  }

  async findByParticipant(shopId: string): Promise<ConversationRecord[]> {
    const docs = await ConversationModel.find({ participants: shopId })
      .sort({ updatedAt: -1 })
      .lean();

    return docs.map((doc) => mapConversationDocumentToRecord(doc));
  }

  async updateLastMessage(conversationId: string, lastMessage: LastMessageRecord): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      last_message: {
        content: lastMessage.content,
        sender_shop_id: lastMessage.senderShopId,
        sender_shop_name: lastMessage.senderShopName,
        created_at: lastMessage.createdAt,
        message_type: lastMessage.messageType ?? 'text',
      },
    });
  }
}
