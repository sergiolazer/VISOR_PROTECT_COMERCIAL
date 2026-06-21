import { randomUUID } from 'node:crypto';
import type { ChatMessageItem, ConversationItem, MessageType } from '@visor-protect/shared';
import type { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import type { IMessageRepository } from '../../domain/repositories/IMessageRepository';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import { CHAT_ERROR_CODES, ChatValidationError } from '../../domain/errors/ChatValidationError';
import type { ImageUrlValidator } from './ImageUrlValidator';
import {
  getLastMessagePreviewContent,
  mapLastMessageToPreview,
  mapMessageRecordToItem,
} from '../../infrastructure/database/mongodb/mappers/chatMapper';
import { env } from '../../config/env';

export interface SendMessageParams {
  conversationId: string;
  senderShopId: string;
  text?: string;
  imageUrl?: string;
}

export interface MarkMessageSeenParams {
  conversationId: string;
  messageId: string;
  shopId: string;
}

export class ChatService {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly shopRepository: IShopRepository,
    private readonly imageUrlValidator: ImageUrlValidator,
  ) {}

  async assertParticipant(conversationId: string, shopId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new ChatValidationError(
        'Conversación no encontrada',
        CHAT_ERROR_CODES.CONVERSATION_NOT_FOUND,
      );
    }

    if (!conversation.participants.includes(shopId)) {
      throw new ChatValidationError(
        'No tiene acceso a esta conversación',
        CHAT_ERROR_CODES.NOT_PARTICIPANT,
      );
    }
  }

  getConversationRoom(conversationId: string): string {
    return conversationId;
  }

  async joinConversation(conversationId: string, shopId: string): Promise<{ room: string }> {
    await this.assertParticipant(conversationId, shopId);
    return { room: this.getConversationRoom(conversationId) };
  }

  async sendMessage(params: SendMessageParams): Promise<ChatMessageItem> {
    await this.assertParticipant(params.conversationId, params.senderShopId);

    const shop = await this.shopRepository.findById(params.senderShopId);
    if (!shop) {
      throw new ChatValidationError(
        'Comercio emisor no encontrado',
        CHAT_ERROR_CODES.NOT_PARTICIPANT,
      );
    }

    const trimmedText = params.text?.trim();
    const hasImage = Boolean(params.imageUrl);
    const messageType: MessageType = hasImage ? 'image' : 'text';

    if (hasImage && params.imageUrl) {
      try {
        this.imageUrlValidator.validate(params.imageUrl);
      } catch (error) {
        throw new ChatValidationError(
          error instanceof Error ? error.message : 'URL de imagen no confiable',
          CHAT_ERROR_CODES.INVALID_IMAGE_URL,
        );
      }
    }

    if (messageType === 'text' && !trimmedText) {
      throw new ChatValidationError(
        'El mensaje de texto no puede estar vacío',
        CHAT_ERROR_CODES.INVALID_TARGET,
      );
    }

    const record = await this.messageRepository.create({
      id: randomUUID(),
      conversationId: params.conversationId,
      senderShopId: params.senderShopId,
      senderShopName: shop.name,
      type: messageType,
      content: trimmedText,
      imageUrl: params.imageUrl,
    });

    await this.conversationRepository.updateLastMessage(params.conversationId, {
      content: getLastMessagePreviewContent(messageType, trimmedText),
      senderShopId: record.senderShopId,
      senderShopName: record.senderShopName,
      createdAt: record.createdAt,
      messageType,
    });

    return mapMessageRecordToItem(record);
  }

  async markMessageSeen(params: MarkMessageSeenParams): Promise<ChatMessageItem> {
    await this.assertParticipant(params.conversationId, params.shopId);

    const message = await this.messageRepository.findById(params.messageId);
    if (!message || message.conversationId !== params.conversationId) {
      throw new ChatValidationError(
        'Mensaje no encontrado',
        CHAT_ERROR_CODES.MESSAGE_NOT_FOUND,
      );
    }

    const updated = await this.messageRepository.markAsRead(params.messageId, params.shopId);
    if (!updated) {
      throw new ChatValidationError(
        'Mensaje no encontrado',
        CHAT_ERROR_CODES.MESSAGE_NOT_FOUND,
      );
    }

    return mapMessageRecordToItem(updated);
  }

  async getConversations(shopId: string): Promise<ConversationItem[]> {
    const conversations = await this.conversationRepository.findByParticipant(shopId);

    const items: ConversationItem[] = [];
    for (const conversation of conversations) {
      const participantNames: Record<string, string> = {};
      for (const participantId of conversation.participants) {
        const participantShop = await this.shopRepository.findById(participantId);
        if (participantShop) {
          participantNames[participantId] = participantShop.name;
        }
      }

      items.push({
        id: conversation.id,
        type: conversation.type,
        participants: conversation.participants,
        participant_names: participantNames,
        last_message: conversation.lastMessage
          ? mapLastMessageToPreview(
              conversation.lastMessage,
              conversation.lastMessage.messageType,
            )
          : undefined,
        updated_at: conversation.updatedAt.toISOString(),
      });
    }

    return items;
  }

  async getMessageHistory(conversationId: string, shopId: string): Promise<ChatMessageItem[]> {
    await this.assertParticipant(conversationId, shopId);

    const records = await this.messageRepository.findByConversation(
      conversationId,
      env.chatHistoryLimit,
    );

    return records.map(mapMessageRecordToItem);
  }

  async createDirectConversation(
    senderShopId: string,
    targetShopId: string,
  ): Promise<ConversationItem> {
    if (senderShopId === targetShopId) {
      throw new ChatValidationError(
        'No puede iniciar chat consigo mismo',
        CHAT_ERROR_CODES.INVALID_TARGET,
      );
    }

    const targetShop = await this.shopRepository.findById(targetShopId);
    if (!targetShop) {
      throw new ChatValidationError(
        'Comercio destino no encontrado',
        CHAT_ERROR_CODES.INVALID_TARGET,
      );
    }

    const existing = await this.conversationRepository.findDirectBetween(senderShopId, targetShopId);
    if (existing) {
      const conversations = await this.getConversations(senderShopId);
      const found = conversations.find((item) => item.id === existing.id);
      if (found) {
        return found;
      }
    }

    const record = await this.conversationRepository.create({
      id: randomUUID(),
      type: 'DIRECT',
      participants: [senderShopId, targetShopId],
    });

    const senderShop = await this.shopRepository.findById(senderShopId);

    return {
      id: record.id,
      type: record.type,
      participants: record.participants,
      participant_names: {
        [senderShopId]: senderShop?.name ?? 'Comercio',
        [targetShopId]: targetShop.name,
      },
      updated_at: record.updatedAt.toISOString(),
    };
  }
}
