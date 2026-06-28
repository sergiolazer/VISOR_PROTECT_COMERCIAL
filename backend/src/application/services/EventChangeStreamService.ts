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
        if (!record.location) {
          return;
        }

        const feedItem = mapEventLogRecordToFeedItem(record, false);

        // Reintento: AlertEvent puede crearse justo después del EventLog (carrera).
        for (let attempt = 1; attempt <= 8; attempt++) {
          const delivered = await this.alertService.broadcastReportFromEventLog(record.id, feedItem);
          if (delivered > 0) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 75 * attempt));
        }
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
