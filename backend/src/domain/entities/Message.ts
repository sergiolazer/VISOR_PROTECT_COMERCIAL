import type { MessageType } from '@visor-protect/shared';

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderShopId: string;
  senderShopName: string;
  type: MessageType;
  content?: string;
  imageUrl?: string;
  readBy: string[];
  createdAt: Date;
}

export interface CreateMessageParams {
  id: string;
  conversationId: string;
  senderShopId: string;
  senderShopName: string;
  type: MessageType;
  content?: string;
  imageUrl?: string;
}
