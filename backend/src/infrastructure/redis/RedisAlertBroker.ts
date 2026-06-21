import type { AlertDispatchMessage } from '@visor-protect/shared';
import { REDIS_ALERT_CHANNEL } from '@visor-protect/shared';
import type Redis from 'ioredis';
import type { AlertDeliveryHandler, IAlertBroker } from '../../domain/services/IAlertBroker';

export class RedisAlertBroker implements IAlertBroker {
  private handler: AlertDeliveryHandler | null = null;

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
  ) {}

  async publish(message: AlertDispatchMessage): Promise<void> {
    await this.publisher.publish(REDIS_ALERT_CHANNEL, JSON.stringify(message));
  }

  async subscribe(handler: AlertDeliveryHandler): Promise<void> {
    this.handler = handler;

    this.subscriber.on('message', async (channel, rawMessage) => {
      if (channel !== REDIS_ALERT_CHANNEL || !this.handler) {
        return;
      }

      try {
        const message = JSON.parse(rawMessage) as AlertDispatchMessage;
        await this.handler(message);
      } catch (error) {
        console.error('[RedisAlertBroker] Error al procesar mensaje:', error);
      }
    });

    await this.subscriber.subscribe(REDIS_ALERT_CHANNEL);
    console.log(`[RedisAlertBroker] Suscrito a canal ${REDIS_ALERT_CHANNEL}`);
  }

  async disconnect(): Promise<void> {
    this.handler = null;
    await this.subscriber.unsubscribe(REDIS_ALERT_CHANNEL).catch(() => undefined);
  }
}
