import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { CHAT_MESSAGE_RETENTION_DAYS } from '@visor-protect/shared';
import type { ExportMessageRow } from '../../domain/entities/ExportMessageRow';
import type { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import type { IMessageRepository } from '../../domain/repositories/IMessageRepository';
import type { IAuditLogRepository } from '../../domain/repositories/IAuditLogRepository';
import type { IExportMessageStream } from '../../domain/repositories/IExportMessageStream';
import { escapeCsvField, formatMessageBody } from '../utils/csvUtils';

export type ChatExportResult = 'empty' | 'success' | 'aborted';

export class ChatExportService {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async exportChatHistoryToCsv(
    shopId: string,
    userId: string,
    res: Response,
  ): Promise<ChatExportResult> {
    const conversations = await this.conversationRepository.findByParticipant(shopId);
    const conversationIds = conversations.map((item) => item.id);

    const hasMessages = await this.messageRepository.hasMessagesInConversations(conversationIds);
    if (!hasMessages) {
      return 'empty';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=historial_seguridad_${shopId}.csv`,
    );

    res.write('\uFEFF');
    res.write('Fecha,Remitente,Tipo,Mensaje,URL Imagen\n');

    const stream = this.messageRepository.createExportStream(conversationIds);

    return this.streamChatHistory(shopId, userId, conversationIds.length, res, stream);
  }

  private streamChatHistory(
    shopId: string,
    userId: string,
    conversationCount: number,
    res: Response,
    stream: IExportMessageStream,
  ): Promise<ChatExportResult> {
    return new Promise((resolve, reject) => {
      let messageCount = 0;
      let settled = false;

      const finish = (result: ChatExportResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        res.removeListener('close', onClientClose);
        res.removeListener('drain', onDrain);
        void stream.close();
      };

      const onClientClose = () => {
        finish('aborted');
      };

      const onDrain = () => {
        stream.resume();
      };

      const writeRow = (row: ExportMessageRow): void => {
        const csvLine = [
          escapeCsvField(row.createdAt.toISOString()),
          escapeCsvField(row.senderShopName),
          escapeCsvField(row.messageType),
          escapeCsvField(formatMessageBody(row.messageType, row.content, row.imageUrl)),
          escapeCsvField(row.imageUrl ?? ''),
        ].join(',');

        const canContinue = res.write(`${csvLine}\n`);
        messageCount++;

        if (!canContinue) {
          stream.pause();
        }
      };

      res.on('close', onClientClose);
      res.on('drain', onDrain);

      stream.on('data', writeRow);

      stream.on('error', (error) => {
        if (!res.headersSent) {
          fail(error);
          return;
        }

        if (!res.writableEnded) {
          res.end();
        }

        fail(error);
      });

      stream.on('end', () => {
        void (async () => {
          try {
            await this.auditLogRepository.create({
              id: randomUUID(),
              shopId,
              userId,
              action: 'EXPORT_CHAT',
              metadata: {
                message_count: messageCount,
                conversation_count: conversationCount,
                retention_days: CHAT_MESSAGE_RETENTION_DAYS,
              },
            });

            if (!res.writableEnded) {
              res.end();
            }

            finish('success');
          } catch (error) {
            if (!res.writableEnded) {
              res.end();
            }
            fail(error instanceof Error ? error : new Error('Error al registrar auditoría'));
          }
        })();
      });
    });
  }
}
