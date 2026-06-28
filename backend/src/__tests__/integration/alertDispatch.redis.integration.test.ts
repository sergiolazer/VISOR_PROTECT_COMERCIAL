import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SOCKET_EVENTS, type FeedEventItem } from '@visor-protect/shared';
import {
  buildTestFeedItem,
  connectShopClient,
  createAlertTestHarness,
  isRedisReachable,
  waitForConnect,
  waitForSocketEvent,
} from '../../test-utils/alertTestHarness';
import {
  seedDemoShops,
  SHOP_A_ID,
  SHOP_B_ID,
  SHOP_A_LOCATION,
  DEMO_CITY,
} from '../../test-utils/demoShopsFixture';
import { createAlertBroker } from '../../infrastructure/redis/createAlertBroker';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

describe('AlertDispatch A → B (Redis multi-node)', () => {
  let memoryServer: MongoMemoryServer;
  let harnessNode1: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let harnessNode2: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let cleanupBrokers: Array<() => Promise<void>> = [];
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isRedisReachable(REDIS_URL);
    if (!redisAvailable) {
      console.warn(
        `[integration] Redis no disponible en ${REDIS_URL}. ` +
          'Ejecute "docker compose up -d redis" para habilitar pruebas multi-node.',
      );
      return;
    }

    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());

    const broker1 = await createAlertBroker(REDIS_URL);
    const broker2 = await createAlertBroker(REDIS_URL);
    cleanupBrokers = [broker1.cleanup, broker2.cleanup];

    harnessNode1 = await createAlertTestHarness(broker1.broker, 'integration-node-1');
    harnessNode2 = await createAlertTestHarness(broker2.broker, 'integration-node-2');
  });

  beforeEach(async () => {
    if (!redisAvailable) {
      return;
    }
    await seedDemoShops();
  });

  afterAll(async () => {
    if (!redisAvailable) {
      return;
    }
    await harnessNode1.close();
    await harnessNode2.close();
    for (const cleanup of cleanupBrokers) {
      await cleanup();
    }
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it('comercio B en nodo 2 recibe alerta publicada desde nodo 1 vía Redis Pub/Sub', async ({ skip }) => {
    if (!redisAvailable) {
      skip();
      return;
    }

    const socketB = connectShopClient(harnessNode2.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const eventId = randomUUID();
    const feedItem = buildTestFeedItem(eventId);
    const receivedPromise = waitForSocketEvent<FeedEventItem>(socketB, SOCKET_EVENTS.PANIC_ALERTS);

    const result = await harnessNode1.alertDispatch.dispatchToGeofence({
      eventId,
      socketEvent: SOCKET_EVENTS.PANIC_ALERTS,
      payload: feedItem,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      senderShopId: SHOP_A_ID,
      city: DEMO_CITY,
      urgencyLevel: 'CRITICAL',
    });

    expect(result.recipientShopIds).toContain(SHOP_B_ID);

    const received = await receivedPromise;
    expect(received.id).toBe(eventId);
    expect(received.alert_type).toBe('ROBO');

    socketB.disconnect();
  });
});
