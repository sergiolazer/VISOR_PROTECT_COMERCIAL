import type {
  ConversationRecord,
  CreateConversationParams,
  LastMessageRecord,
} from '../entities/Conversation';

export interface IConversationRepository {
  create(params: CreateConversationParams): Promise<ConversationRecord>;
  findById(conversationId: string): Promise<ConversationRecord | null>;
  findDirectBetween(shopA: string, shopB: string): Promise<ConversationRecord | null>;
  findByParticipant(shopId: string): Promise<ConversationRecord[]>;
  updateLastMessage(conversationId: string, lastMessage: LastMessageRecord): Promise<void>;
}
