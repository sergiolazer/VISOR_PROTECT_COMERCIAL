import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SOCKET_EVENTS, type FeedEventItem } from '@visor-protect/shared';
import { InProcessAlertBroker } from '../../infrastructure/redis/InProcessAlertBroker';
import {
  buildTestFeedItem,
  connectShopClient,
  createAlertTestHarness,
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

describe('AlertDispatch A → B (single-node / InProcess)', () => {
  let memoryServer: MongoMemoryServer;
  let harness: Awaited<ReturnType<typeof createAlertTestHarness>>;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
    harness = await createAlertTestHarness(new InProcessAlertBroker(), 'test-node-1');
  });

  beforeEach(async () => {
    await seedDemoShops();
  });

  afterAll(async () => {
    await harness.close();
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it('comercio B recibe panic_alerts cuando A emite dentro del geocercado', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const eventId = randomUUID();
    const feedItem = buildTestFeedItem(eventId);
    const receivedPromise = waitForSocketEvent<FeedEventItem>(socketB, SOCKET_EVENTS.PANIC_ALERTS);

    const { eligibleShopCount, recipientShopIds } = await harness.alertDispatch.dispatchToGeofence({
      eventId,
      socketEvent: SOCKET_EVENTS.PANIC_ALERTS,
      payload: feedItem,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      senderShopId: SHOP_A_ID,
      city: DEMO_CITY,
      urgencyLevel: 'CRITICAL',
    });

    expect(eligibleShopCount).toBe(1);
    expect(recipientShopIds).toEqual([SHOP_B_ID]);

    const received = await receivedPromise;
    expect(received.id).toBe(eventId);
    expect(received.sender_shop_id).toBe(SHOP_A_ID);

    socketB.disconnect();
  });
});
