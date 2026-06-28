export const MESSAGE_TYPES = ['text', 'image'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface LastMessagePreview {
  content: string;
  sender_shop_id: string;
  sender_shop_name: string;
  created_at: string;
  type?: MessageType;
}

export interface ConversationItem {
  id: string;
  type: ConversationType;
  participants: string[];
  participant_names: Record<string, string>;
  last_message?: LastMessagePreview;
  updated_at: string;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  sender_shop_id: string;
  sender_shop_name: string;
  type: MessageType;
  content?: string;
  image_url?: string;
  read_by: string[];
  created_at: string;
}

export const CONVERSATION_TYPES = ['DIRECT', 'GROUP'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const IMAGE_MESSAGE_PREVIEW = '📷 Imagem';

/** Retenção automática de mensagens de chat (LGPD — minimização de dados). */
export const CHAT_MESSAGE_RETENTION_DAYS = 7;
export const CHAT_MESSAGE_RETENTION_SECONDS = 604800;
export const CHAT_RETENTION_NOTICE =
  'Por segurança e privacidade, mensagens e imagens são excluídas automaticamente após 7 dias.';

export const CHAT_EXPORT_NOTICE =
  'Este arquivo contém o backup dos seus relatos de segurança dos últimos 7 dias. Guarde-o em local seguro sob sua responsabilidade.';
