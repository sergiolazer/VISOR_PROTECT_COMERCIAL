import type { ChatMessageItem, ConversationItem } from '@visor-protect/shared';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import { getSocket } from './socket';

import { API_URL } from './apiConfig';

const fetchOptions: RequestInit = {
  credentials: 'include',
};

export async function fetchConversations(): Promise<ConversationItem[]> {
  const response = await fetch(`${API_URL}/api/chat/conversations`, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Erro ao carregar conversas');
  }

  return (data.conversations ?? []) as ConversationItem[];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessageItem[]> {
  const response = await fetch(`${API_URL}/api/messages/${conversationId}`, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Erro ao carregar mensagens');
  }

  return (data.messages ?? []) as ChatMessageItem[];
}

export async function createDirectConversation(targetShopId: string): Promise<ConversationItem> {
  const response = await fetch(`${API_URL}/api/chat/conversations`, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_shop_id: targetShopId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Erro ao criar conversa');
  }

  return data as ConversationItem;
}

export function joinConversationSocket(conversationId: string): Promise<void> {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    const onJoined = (data: { conversation_id: string }) => {
      if (data.conversation_id === conversationId) {
        cleanup();
        resolve();
      }
    };

    const onError = (error: { message: string }) => {
      cleanup();
      reject(new Error(error.message));
    };

    const cleanup = () => {
      socket.off(SOCKET_EVENTS.CONVERSATION_JOINED, onJoined);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };

    socket.on(SOCKET_EVENTS.CONVERSATION_JOINED, onJoined);
    socket.on(SOCKET_EVENTS.ERROR, onError);
    socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, { conversation_id: conversationId });
  });
}

export function sendChatMessage(
  conversationId: string,
  payload: { text?: string; imageUrl?: string },
): void {
  getSocket().emit(SOCKET_EVENTS.SEND_MESSAGE, {
    conversation_id: conversationId,
    text: payload.text,
    image_url: payload.imageUrl,
  });
}

export function markMessageSeen(conversationId: string, messageId: string): void {
  getSocket().emit(SOCKET_EVENTS.MESSAGE_SEEN, {
    conversation_id: conversationId,
    message_id: messageId,
  });
}

export function subscribeToChatEvents(handlers: {
  onNewMessage: (message: ChatMessageItem) => void;
  onMessageRead: (payload: {
    conversation_id: string;
    message_id: string;
    read_by: string[];
    reader_shop_id: string;
  }) => void;
}): () => void {
  const socket = getSocket();

  socket.on(SOCKET_EVENTS.NEW_MESSAGE, handlers.onNewMessage);
  socket.on(SOCKET_EVENTS.MESSAGE_READ, handlers.onMessageRead);

  return () => {
    socket.off(SOCKET_EVENTS.NEW_MESSAGE, handlers.onNewMessage);
    socket.off(SOCKET_EVENTS.MESSAGE_READ, handlers.onMessageRead);
  };
}

export function formatChatTime(isoDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function getConversationTitle(
  conversation: ConversationItem,
  currentShopId: string,
): string {
  const otherIds = conversation.participants.filter((id) => id !== currentShopId);
  if (otherIds.length === 0) {
    return 'Conversa';
  }

  return otherIds
    .map((id) => conversation.participant_names[id] ?? 'Comércio')
    .join(', ');
}
