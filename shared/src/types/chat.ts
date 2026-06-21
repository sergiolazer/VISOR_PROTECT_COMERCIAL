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

export const IMAGE_MESSAGE_PREVIEW = '📷 Imagen';

/** Retención automática de mensajes de chat (LGPD — minimización de datos). */
export const CHAT_MESSAGE_RETENTION_DAYS = 7;
export const CHAT_MESSAGE_RETENTION_SECONDS = 604800;
export const CHAT_RETENTION_NOTICE =
  'Por seguridad y privacidad, los mensajes e imágenes se eliminan automáticamente tras 7 días.';

export const CHAT_EXPORT_NOTICE =
  'Este archivo contiene el respaldo de tus alertas de seguridad de los últimos 7 días. Consérvalo en un lugar seguro bajo tu responsabilidad.';
