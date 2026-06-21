import { useCallback, useEffect, useState } from 'react';
import type { ChatMessageItem, ConversationItem } from '@visor-protect/shared';
import { IMAGE_MESSAGE_PREVIEW } from '@visor-protect/shared';
import {
  createDirectConversation,
  fetchConversations,
  fetchMessages,
  joinConversationSocket,
  markMessageSeen,
  subscribeToChatEvents,
} from '../lib/chat';

interface UseChatOptions {
  currentShopId: string | null;
  enabled: boolean;
}

export function useChat({ currentShopId, enabled }: UseChatOptions) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!enabled || !currentShopId) {
      return;
    }

    setLoadingConversations(true);
    setError(null);

    try {
      const items = await fetchConversations();
      setConversations(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
    } finally {
      setLoadingConversations(false);
    }
  }, [currentShopId, enabled]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!currentShopId) {
        return;
      }

      setActiveConversationId(conversationId);
      setLoadingMessages(true);
      setError(null);

      try {
        const history = await fetchMessages(conversationId);
        setMessages(history);
        await joinConversationSocket(conversationId);

        for (const message of history) {
          if (
            message.sender_shop_id !== currentShopId &&
            !message.read_by.includes(currentShopId)
          ) {
            markMessageSeen(conversationId, message.id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al abrir conversación');
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentShopId],
  );

  const startDirectChat = useCallback(
    async (targetShopId: string) => {
      const conversation = await createDirectConversation(targetShopId);
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === conversation.id);
        return exists ? prev : [conversation, ...prev];
      });
      await openConversation(conversation.id);
    },
    [openConversation],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!enabled || !currentShopId) {
      return;
    }

    return subscribeToChatEvents({
      onNewMessage: (message) => {
        if (message.conversation_id === activeConversationId) {
          setMessages((prev) => {
            if (prev.some((item) => item.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });

          if (message.sender_shop_id !== currentShopId) {
            markMessageSeen(message.conversation_id, message.id);
          }
        }

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === message.conversation_id
              ? {
                  ...conversation,
                  last_message: {
                    content:
                      message.type === 'image'
                        ? IMAGE_MESSAGE_PREVIEW
                        : message.content ?? '',
                    sender_shop_id: message.sender_shop_id,
                    sender_shop_name: message.sender_shop_name,
                    created_at: message.created_at,
                    type: message.type,
                  },
                  updated_at: message.created_at,
                }
              : conversation,
          ),
        );
      },
      onMessageRead: (payload) => {
        if (payload.conversation_id !== activeConversationId) {
          return;
        }

        setMessages((prev) =>
          prev.map((message) =>
            message.id === payload.message_id
              ? { ...message, read_by: payload.read_by }
              : message,
          ),
        );
      },
    });
  }, [activeConversationId, currentShopId, enabled]);

  return {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    error,
    openConversation,
    startDirectChat,
    reloadConversations: loadConversations,
  };
}
