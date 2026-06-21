import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer } from 'socket.io';
import type { AlertDispatchMessage } from '@visor-protect/shared';
import { getShopRoomName } from '@visor-protect/shared';
import type { IAlertBroker } from '../../domain/services/IAlertBroker';
import type {
  GeofencedDispatchInput,
  GeofencedDispatchResult,
  IAlertDispatchService,
  PersonalizedDispatchInput,
} from '../../domain/services/IAlertDispatchService';
import { GeofenceService } from './GeofenceService';

export class AlertDispatchService implements IAlertDispatchService {
  private readonly instanceId: string;

  constructor(
    private readonly io: SocketIOServer,
    private readonly alertBroker: IAlertBroker,
    private readonly geofenceService: GeofenceService,
    instanceId?: string,
  ) {
    this.instanceId = instanceId ?? randomUUID();
  }

  async start(): Promise<void> {
    await this.alertBroker.subscribe(async (message) => {
      await this.deliverLocally(message);
    });
  }

  async dispatchToGeofence(input: GeofencedDispatchInput): Promise<GeofencedDispatchResult> {
    const { shopIds, radiusMeters } = await this.geofenceService.resolveRecipientShopIds({
      lat: input.lat,
      lng: input.lng,
      senderShopId: input.senderShopId,
      city: input.city,
      urgencyLevel: input.urgencyLevel,
    });

    const geofence = {
      lat: input.lat,
      lng: input.lng,
      radius_meters: radiusMeters,
    };

    const message: AlertDispatchMessage = {
      event_id: input.eventId,
      socket_event: input.socketEvent,
      payload: input.payload,
      recipient_shop_ids: shopIds,
      exclude_socket_id: input.excludeSocketId,
      origin_instance_id: this.instanceId,
      geofence,
      published_at: new Date().toISOString(),
    };

    await this.alertBroker.publish(message);

    return {
      eligibleShopCount: shopIds.length,
      recipientShopIds: shopIds,
      geofence,
    };
  }

  async dispatchPersonalized(input: PersonalizedDispatchInput): Promise<{ deliveredTargets: number }> {
    const geofence = {
      lat: input.lat,
      lng: input.lng,
      radius_meters: input.radiusMeters,
    };

    const message: AlertDispatchMessage = {
      event_id: input.eventId,
      socket_event: input.socketEvent,
      personalized_deliveries: input.deliveries.map((delivery) => ({
        shop_id: delivery.shopId,
        payload: delivery.payload,
      })),
      exclude_socket_id: input.excludeSocketId,
      origin_instance_id: this.instanceId,
      geofence,
      published_at: new Date().toISOString(),
    };

    await this.alertBroker.publish(message);

    return { deliveredTargets: input.deliveries.length };
  }

  async deliverLocally(message: AlertDispatchMessage): Promise<number> {
    if (message.personalized_deliveries?.length) {
      return this.deliverPersonalizedLocally(message);
    }

    if (!message.recipient_shop_ids?.length || message.payload === undefined) {
      return 0;
    }

    let deliveredCount = 0;

    for (const shopId of message.recipient_shop_ids) {
      const roomName = getShopRoomName(shopId);
      const sockets = await this.io.in(roomName).fetchSockets();

      for (const remoteSocket of sockets) {
        if (message.exclude_socket_id && remoteSocket.id === message.exclude_socket_id) {
          continue;
        }

        remoteSocket.emit(message.socket_event, message.payload);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  private async deliverPersonalizedLocally(message: AlertDispatchMessage): Promise<number> {
    let deliveredCount = 0;

    for (const delivery of message.personalized_deliveries ?? []) {
      const roomName = getShopRoomName(delivery.shop_id);
      const sockets = await this.io.in(roomName).fetchSockets();

      for (const remoteSocket of sockets) {
        if (message.exclude_socket_id && remoteSocket.id === message.exclude_socket_id) {
          continue;
        }

        remoteSocket.emit(message.socket_event, delivery.payload);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  async stop(): Promise<void> {
    await this.alertBroker.disconnect();
  }
}
