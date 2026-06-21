import { AlertEventModel } from './models/AlertEvent.model';
import { ShopModel } from './models/Shop.model';
import { AlertFilterLogModel } from './models/AlertFilterLog.model';
import { MessageModel } from './models/Message.model';

/**
 * Garantiza índices geoespaciales, TTL y compuestos en despliegue.
 * db.alertEvents.createIndex({ location: "2dsphere", type: 1, createdAt: -1 })
 */
export async function syncMongoIndexes(): Promise<void> {
  await Promise.all([
    AlertEventModel.syncIndexes(),
    ShopModel.syncIndexes(),
    AlertFilterLogModel.syncIndexes(),
    MessageModel.syncIndexes(),
  ]);
  console.log('[MongoDB] Índices sincronizados (alert_events, shops, alert_filter_logs, messages)');
}
