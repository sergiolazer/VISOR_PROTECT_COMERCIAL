import { Router } from 'express';
import type { ChatController } from '../controllers/chatController';
import { createShopAuthMiddleware } from '../middleware/authMiddleware';
import type { AuthService } from '../../application/services/AuthService';

export function createChatRouter(
  authService: AuthService,
  chatController: ChatController,
): Router {
  const router = Router();
  const requireShopAuth = createShopAuthMiddleware(authService);

  router.get('/conversations', requireShopAuth, chatController.listConversations);
  router.post('/conversations', requireShopAuth, chatController.createDirectConversation);
  router.get('/export/:shopId', requireShopAuth, chatController.exportChatHistory);

  return router;
}

export function createMessagesRouter(
  authService: AuthService,
  chatController: ChatController,
): Router {
  const router = Router();
  const requireShopAuth = createShopAuthMiddleware(authService);

  router.get('/:conversationId', requireShopAuth, chatController.getMessages);

  return router;
}
