import type { CreateMessageParams, MessageRecord } from '../entities/Message';
import type { IExportMessageStream } from './IExportMessageStream';

export interface IMessageRepository {
  create(params: CreateMessageParams): Promise<MessageRecord>;
  findByConversation(conversationId: string, limit: number): Promise<MessageRecord[]>;
  findById(messageId: string): Promise<MessageRecord | null>;
  markAsRead(messageId: string, shopId: string): Promise<MessageRecord | null>;
  createExportStream(conversationIds: string[]): IExportMessageStream;
  hasMessagesInConversations(conversationIds: string[]): Promise<boolean>;
}
