import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SOCKET_EVENTS, type AlertPushNotificationDto } from '@visor-protect/shared';
import { InProcessAlertBroker } from '../../infrastructure/redis/InProcessAlertBroker';
import type { AlertBroadcastService } from '../../application/services/AlertBroadcastService';
import type { AlertEventRecord } from '../../domain/entities/AlertEvent';
import {
  connectShopClient,
  createAlertTestHarness,
  waitForConnect,
  waitForSocketEvent,
} from '../../test-utils/alertTestHarness';
import { createTestAlertService } from '../../test-utils/createTestAlertService';
import {
  seedDemoShops,
  SHOP_A_ID,
  SHOP_B_ID,
  SHOP_A_LOCATION,
} from '../../test-utils/demoShopsFixture';

function buildEvent(overrides: Partial<AlertEventRecord> = {}): AlertEventRecord {
  return {
    id: randomUUID(),
    shopId: SHOP_A_ID,
    senderShopName: 'Comercio Demo Centro',
    city: 'São Paulo',
    type: 'INTRUSION',
    severity: 'MEDIA',
    location: SHOP_A_LOCATION,
    description: 'Intento de intrusión detectado en acceso lateral',
    metadata: { source: 'manual' },
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AlertBroadcastService — filtrado inteligente', () => {
  let memoryServer: MongoMemoryServer;
  let harness: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let broadcastService: AlertBroadcastService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());

    const broker = new InProcessAlertBroker();
    harness = await createAlertTestHarness(broker, 'alert-broadcast-test');
    ({ broadcastService } = createTestAlertService(harness));
  });

  beforeEach(async () => {
    await seedDemoShops();
  });

  afterAll(async () => {
    await harness.close();
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it('MEDIA + INTRUSION no notifica a comercio B (solo suscrito a ROBO/EMERGENCIA)', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    let received = false;
    socketB.on(SOCKET_EVENTS.ALERT_PUSH, () => {
      received = true;
    });

    const result = await broadcastService.broadcast(buildEvent());

    expect(result.recipientCount).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).toBe(false);

    socketB.disconnect();
  });

  it('CRITICA ignora subscribedEventTypes y notifica a comercio B', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const event = buildEvent({
      type: 'INTRUSION',
      severity: 'CRITICA',
      description: 'Intrusión crítica en perímetro del local',
    });

    const receivedPromise = waitForSocketEvent<AlertPushNotificationDto>(
      socketB,
      SOCKET_EVENTS.ALERT_PUSH,
    );

    const result = await broadcastService.broadcast(event);

    expect(result.recipientCount).toBe(1);
    expect(result.recipients[0]?.shopId).toBe(SHOP_B_ID);

    const push = await receivedPromise;
    expect(push.eventId).toBe(event.id);
    expect(push.severity).toBe('CRITICA');
    expect(push.distance).toBeGreaterThan(0);
    expect(push.message).toBe(event.description);

    socketB.disconnect();
  });

  it('MEDIA + ROBO sí notifica a comercio B suscrito', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const event = buildEvent({
      type: 'ROBO',
      severity: 'MEDIA',
      description: 'Intento de robo detectado en vitrina',
    });

    const receivedPromise = waitForSocketEvent<AlertPushNotificationDto>(
      socketB,
      SOCKET_EVENTS.ALERT_PUSH,
    );

    const result = await broadcastService.broadcast(event);
    expect(result.recipientCount).toBe(1);

    const push = await receivedPromise;
    expect(push.type).toBe('ROBO');
    expect(push.severity).toBe('MEDIA');

    socketB.disconnect();
  });
});
