import type { Socket } from 'socket.io';
import { createAlertEventClientSchema, SOCKET_EVENTS } from '@visor-protect/shared';
import type { AlertService } from '../AlertService';
import { ShopContextService } from '../ShopContextService';
import { emitSocketError } from './socketErrorHandler';

export interface AlertHandlerDeps {
  alertService: AlertService;
  shopContextService: ShopContextService;
}

export function registerAlertHandlers(socket: Socket, deps: AlertHandlerDeps): void {
  socket.on(SOCKET_EVENTS.CREATE_ALERT_EVENT, async (payload: unknown) => {
    try {
      deps.shopContextService.assertShopIdPresent(socket.data.shopId);
      const input = createAlertEventClientSchema.parse(payload);

      const { event, recipientCount } = await deps.alertService.createAndBroadcast({
        shopId: socket.data.shopId,
        type: input.type,
        severity: input.severity,
        lat: input.lat,
        lng: input.lng,
        description: input.description,
        metadata: input.metadata,
        excludeSocketId: socket.id,
      });

      socket.emit(SOCKET_EVENTS.ALERT_EVENT_ACK, {
        event_id: event.id,
        recipient_count: recipientCount,
        severity: event.severity,
        type: event.type,
        created_at: event.createdAt.toISOString(),
      });
    } catch (error) {
      emitSocketError(socket, error, 'Error al crear alerta');
    }
  });
}
