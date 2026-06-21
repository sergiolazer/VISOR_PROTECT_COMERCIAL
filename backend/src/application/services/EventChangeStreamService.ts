import type { AlertService } from '../../application/services/AlertService';
import { EventLogModel } from '../../infrastructure/database/mongodb/models/EventLog.model';
import {
  mapEventLogDocumentToRecord,
  mapEventLogRecordToFeedItem,
} from '../../infrastructure/database/mongodb/mappers/eventLogMapper';

export class EventChangeStreamService {
  private changeStream: ReturnType<typeof EventLogModel.watch> | null = null;

  constructor(private readonly alertService: AlertService) { }

  start(): void {
    if (this.changeStream) {
      return;
    }

    this.changeStream = EventLogModel.watch(
      [{ $match: { operationType: 'insert', 'fullDocument.type': 'REEL_REPORT' } }],
      { fullDocument: 'updateLookup' },
    );

    this.changeStream.on('change', async (change) => {
      if (change.operationType !== 'insert' || !change.fullDocument) {
        return;
      }

      try {
        const record = mapEventLogDocumentToRecord(change.fullDocument);
        const feedItem = mapEventLogRecordToFeedItem(record, false);

        if (!record.location) {
          return;
        }

        await this.alertService.broadcastReportFromEventLog(record.id, feedItem);
      } catch (error) {
        console.error('[ChangeStream] Error al procesar evento:', error);
      }
    });

    this.changeStream.on('error', (error) => {
      console.error('[ChangeStream] Error en stream:', error);
    });

    console.log('[ChangeStream] Escuchando inserciones REEL_REPORT con pipeline de filtrado');
  }

  async stop(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }
  }
}
