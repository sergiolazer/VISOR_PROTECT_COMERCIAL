import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { getShopRoomName, SOCKET_EVENTS, type FeedEventItem } from '@visor-protect/shared';
import type { IAlertBroker } from '../domain/services/IAlertBroker';
import { AlertDispatchService } from '../application/services/AlertDispatchService';
import { GeofenceService } from '../application/services/GeofenceService';
import { MongoShopRepository } from '../infrastructure/database/mongodb/repositories/MongoShopRepository';
import { SHOP_A_ID } from './demoShopsFixture';

export interface AlertTestHarness {
  url: string;
  io: SocketIOServer;
  alertDispatch: AlertDispatchService;
  shopRepository: MongoShopRepository;
  close: () => Promise<void>;
}

export async function createAlertTestHarness(
  broker: IAlertBroker,
  instanceId: string,
): Promise<AlertTestHarness> {
  const httpServer = http.createServer();
  const io = new SocketIOServer(httpServer, {
    transports: ['websocket'],
  });

  io.on('connection', (socket) => {
    const shopId = socket.handshake.auth.shopId as string | undefined;
    if (shopId) {
      socket.join(getShopRoomName(shopId));
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('No se pudo obtener puerto del servidor de prueba');
  }

  const shopRepository = new MongoShopRepository();
  const geofenceService = new GeofenceService(shopRepository);
  const alertDispatch = new AlertDispatchService(io, broker, geofenceService, instanceId);
  await alertDispatch.start();

  return {
    url: `http://127.0.0.1:${address.port}`,
    io,
    alertDispatch,
    shopRepository,
    close: async () => {
      await alertDispatch.stop();
      io.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export function connectShopClient(baseUrl: string, shopId: string): ClientSocket {
  return ioClient(baseUrl, {
    transports: ['websocket'],
    auth: { shopId },
    forceNew: true,
  });
}

export function waitForSocketEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout esperando evento "${event}" tras ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export function waitForConnect(socket: ClientSocket, timeoutMs = 10_000): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout esperando conexión Socket.io'));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export function buildTestFeedItem(eventId: string): FeedEventItem {
  return {
    id: eventId,
    event_type: 'PANIC_ALERT',
    city: 'São Paulo',
    sender_shop_id: SHOP_A_ID,
    sender_shop_name: 'Comercio Demo Centro',
    description: 'Alerta ROBO — CRITICAL',
    location: { lat: -23.5614, lng: -46.6553 },
    alert_type: 'ROBO',
    urgency_level: 'CRITICAL',
    icon_type: 'suspicious',
    confirmation_count: 0,
    confirmed_by_shop: false,
    created_at: new Date().toISOString(),
  };
}

export async function isRedisReachable(redisUrl: string): Promise<boolean> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  client.on('error', () => undefined);

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => undefined);
  }
}

export { SOCKET_EVENTS };
