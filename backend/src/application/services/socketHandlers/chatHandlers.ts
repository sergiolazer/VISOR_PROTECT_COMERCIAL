import type { Server as SocketIOServer, Socket } from 'socket.io';
import {
  joinConversationSchema,
  messageSeenSchema,
  sendMessageSchema,
  SOCKET_EVENTS,
} from '@visor-protect/shared';
import type { ChatService } from '../ChatService';
import type { ShopContextService } from '../ShopContextService';
import { emitSocketError } from './socketErrorHandler';

export interface ChatHandlerDeps {
  chatService: ChatService;
  shopContextService: ShopContextService;
  io: SocketIOServer;
}

export function registerChatHandlers(socket: Socket, deps: ChatHandlerDeps): void {
  socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const { conversation_id } = joinConversationSchema.parse(payload);

      const { room } = await deps.chatService.joinConversation(
        conversation_id,
        socket.data.shopId,
      );

      socket.join(room);

      socket.emit(SOCKET_EVENTS.CONVERSATION_JOINED, {
        conversation_id,
        room,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al unirse a la conversación');
    }
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = sendMessageSchema.parse(payload);

      const message = await deps.chatService.sendMessage({
        conversationId: input.conversation_id,
        senderShopId: socket.data.shopId,
        text: input.text,
        imageUrl: input.image_url,
      });

      deps.io.to(input.conversation_id).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    } catch (error) {
      emitSocketError(socket, error, 'Error al enviar mensaje');
    }
  });

  socket.on(SOCKET_EVENTS.MESSAGE_SEEN, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = messageSeenSchema.parse(payload);

      const message = await deps.chatService.markMessageSeen({
        conversationId: input.conversation_id,
        messageId: input.message_id,
        shopId: socket.data.shopId,
      });

      deps.io.to(input.conversation_id).emit(SOCKET_EVENTS.MESSAGE_READ, {
        conversation_id: input.conversation_id,
        message_id: input.message_id,
        read_by: message.read_by,
        reader_shop_id: socket.data.shopId,
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al marcar mensaje como leído');
    }
  });
}
