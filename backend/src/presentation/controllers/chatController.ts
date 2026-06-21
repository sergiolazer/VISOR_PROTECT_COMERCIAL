import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ChatService } from '../../application/services/ChatService';
import type { ChatExportService } from '../../application/services/ChatExportService';
import type { AuthService } from '../../application/services/AuthService';
import { AuthError } from '../../domain/errors/AuthError';
import { ChatValidationError } from '../../domain/errors/ChatValidationError';
import { createDirectConversationSchema } from '@visor-protect/shared';

export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatExportService: ChatExportService,
    private readonly authService: AuthService,
  ) {}

  listConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.shopId) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      const conversations = await this.chatService.getConversations(req.user.shopId);
      res.json({ conversations });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.shopId) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      const conversationId = z.string().uuid().parse(req.params.conversationId);
      const messages = await this.chatService.getMessageHistory(conversationId, req.user.shopId);
      res.json({ conversation_id: conversationId, messages });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  createDirectConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.shopId) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      const { target_shop_id } = createDirectConversationSchema.parse(req.body);
      const conversation = await this.chatService.createDirectConversation(
        req.user.shopId,
        target_shop_id,
      );

      res.status(201).json(conversation);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  exportChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ message: 'No autenticado', code: 'TOKEN_REQUIRED' });
        return;
      }

      const shopId = z.string().uuid().parse(req.params.shopId);

      if (shopId !== req.user.shopId) {
        res.status(403).json({
          message: 'No puede exportar el historial de otro comercio',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      await this.authService.assertShopAccess(req.user.userId, shopId);

      const result = await this.chatExportService.exportChatHistoryToCsv(
        shopId,
        req.user.userId,
        res,
      );

      if (result === 'empty') {
        res.status(404).json({ message: 'No hay historial disponible para exportar.' });
        return;
      }

      if (result === 'aborted') {
        console.info(`[ChatController] Exportación abortada por cierre de conexión — shop ${shopId}`);
      }
    } catch (error) {
      if (res.headersSent) {
        console.error('[ChatController] Error durante streaming de exportación:', error);
        if (!res.writableEnded) {
          res.destroy();
        }
        return;
      }

      if (error instanceof AuthError) {
        res.status(403).json({ message: error.message, code: error.code });
        return;
      }

      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown): void {
    if (error instanceof ChatValidationError) {
      const status = error.code === 'NOT_PARTICIPANT' ? 403 : 404;
      res.status(status).json({ message: error.message, code: error.code });
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', details: error.issues });
      return;
    }

    console.error('[ChatController]', error);
    res.status(500).json({ message: 'Error al generar el reporte.' });
  }
}
