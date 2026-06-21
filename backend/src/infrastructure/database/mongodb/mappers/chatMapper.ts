import type { ConversationRecord, LastMessageRecord } from '../../../../domain/entities/Conversation';
import type { MessageRecord } from '../../../../domain/entities/Message';
import type { IConversationDocument } from '../models/Conversation.model';
import type { IMessageDocument } from '../models/Message.model';
import { IMAGE_MESSAGE_PREVIEW, type MessageType } from '@visor-protect/shared';

export function mapConversationDocumentToRecord(
  doc: IConversationDocument | Record<string, unknown>,
): ConversationRecord {
  const d = doc as IConversationDocument;

  return {
    id: String(d._id),
    type: d.type,
    participants: d.participants,
    lastMessage: d.last_message
      ? {
          content: d.last_message.content,
          senderShopId: d.last_message.sender_shop_id,
          senderShopName: d.last_message.sender_shop_name,
          createdAt: d.last_message.created_at instanceof Date
            ? d.last_message.created_at
            : new Date(d.last_message.created_at),
          messageType: d.last_message.message_type,
        }
      : undefined,
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt : new Date(d.updatedAt),
  };
}

export function mapMessageDocumentToRecord(
  doc: IMessageDocument | Record<string, unknown>,
): MessageRecord {
  const d = doc as IMessageDocument;

  return {
    id: String(d._id),
    conversationId: d.conversation_id,
    senderShopId: d.sender_shop_id,
    senderShopName: d.sender_shop_name,
    type: (d.message_type ?? 'text') as MessageType,
    content: d.content ?? undefined,
    imageUrl: d.image_url ?? undefined,
    readBy: d.read_by ?? [],
    createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt),
  };
}

export function mapLastMessageToPreview(lastMessage: LastMessageRecord, messageType?: MessageType) {
  return {
    content: messageType === 'image' ? IMAGE_MESSAGE_PREVIEW : lastMessage.content,
    sender_shop_id: lastMessage.senderShopId,
    sender_shop_name: lastMessage.senderShopName,
    created_at: lastMessage.createdAt.toISOString(),
    type: messageType,
  };
}

export function mapMessageRecordToItem(record: MessageRecord) {
  return {
    id: record.id,
    conversation_id: record.conversationId,
    sender_shop_id: record.senderShopId,
    sender_shop_name: record.senderShopName,
    type: record.type,
    content: record.content,
    image_url: record.imageUrl,
    read_by: record.readBy,
    created_at: record.createdAt.toISOString(),
  };
}

export function getLastMessagePreviewContent(type: MessageType, content?: string): string {
  if (type === 'image') {
    return content?.trim() ? `${IMAGE_MESSAGE_PREVIEW} — ${content.trim()}` : IMAGE_MESSAGE_PREVIEW;
  }
  return content?.trim() ?? '';
}
