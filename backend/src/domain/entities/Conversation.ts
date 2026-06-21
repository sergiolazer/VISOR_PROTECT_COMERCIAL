export type ConversationType = 'DIRECT' | 'GROUP';

import type { MessageType } from '@visor-protect/shared';

export interface LastMessageRecord {
  content: string;
  senderShopId: string;
  senderShopName: string;
  createdAt: Date;
  messageType?: MessageType;
}

export interface ConversationRecord {
  id: string;
  type: ConversationType;
  participants: string[];
  lastMessage?: LastMessageRecord;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationParams {
  id: string;
  type: ConversationType;
  participants: string[];
}
