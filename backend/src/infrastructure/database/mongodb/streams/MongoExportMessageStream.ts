import { EventEmitter } from 'node:events';
import type { ExportMessageRow } from '../../../../domain/entities/ExportMessageRow';
import type { IExportMessageStream } from '../../../../domain/repositories/IExportMessageStream';
import { MessageModel } from '../models/Message.model';

function mapDocToExportRow(doc: {
  createdAt: Date;
  sender_shop_name: string;
  message_type?: string;
  content?: string | null;
  image_url?: string | null;
}): ExportMessageRow {
  return {
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    senderShopName: doc.sender_shop_name,
    messageType: doc.message_type ?? 'text',
    content: doc.content ?? undefined,
    imageUrl: doc.image_url ?? undefined,
  };
}

export class MongoExportMessageStream extends EventEmitter implements IExportMessageStream {
  private readonly cursor;

  constructor(conversationIds: string[]) {
    super();

    this.cursor = MessageModel.find({ conversation_id: { $in: conversationIds } })
      .sort({ createdAt: 1 })
      .lean()
      .cursor();

    this.cursor.on('data', (doc) => {
      this.emit('data', mapDocToExportRow(doc));
    });

    this.cursor.on('end', () => {
      this.emit('end');
    });

    this.cursor.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  pause(): void {
    this.cursor.pause();
  }

  resume(): void {
    this.cursor.resume();
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    await this.cursor.close().catch(() => undefined);
  }
}
