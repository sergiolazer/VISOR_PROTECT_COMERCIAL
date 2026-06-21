import type { FeedEventItem } from '@visor-protect/shared';
import type { AlertEventRecord } from '../entities/AlertEvent';
import type { AlertRecipientRecord } from '../entities/AlertRecipient';

export interface AlertBroadcastOptions {
  excludeSocketId?: string;
  legacyFeedItem?: FeedEventItem;
  feedItem?: FeedEventItem;
  /** Backfill: persiste sin emitir push ni feed en tiempo real. */
  skipBroadcast?: boolean;
}

export interface AlertBroadcastResult {
  eventId: string;
  recipientCount: number;
  recipients: AlertRecipientRecord[];
  filterAudit?: import('@visor-protect/shared').AlertBroadcastFilterAudit;
}

export interface IAlertBroadcastService {
  broadcast(event: AlertEventRecord, options?: AlertBroadcastOptions): Promise<AlertBroadcastResult>;
}
