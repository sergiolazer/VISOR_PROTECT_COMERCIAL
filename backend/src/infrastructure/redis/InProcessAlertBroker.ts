import type { AlertDispatchMessage } from '@visor-protect/shared';
import type { AlertDeliveryHandler, IAlertBroker } from '../../domain/services/IAlertBroker';

/**
 * Broker en memoria para desarrollo sin Redis.
 * Entrega el mensaje al handler local de forma síncrona (single-node).
 */
export class InProcessAlertBroker implements IAlertBroker {
  private handler: AlertDeliveryHandler | null = null;

  async publish(message: AlertDispatchMessage): Promise<void> {
    if (!this.handler) {
      console.warn('[InProcessAlertBroker] Sin suscriptor activo; mensaje descartado');
      return;
    }

    await this.handler(message);
  }

  async subscribe(handler: AlertDeliveryHandler): Promise<void> {
    this.handler = handler;
    console.log('[InProcessAlertBroker] Modo single-node (Redis deshabilitado)');
  }

  async disconnect(): Promise<void> {
    this.handler = null;
  }
}
