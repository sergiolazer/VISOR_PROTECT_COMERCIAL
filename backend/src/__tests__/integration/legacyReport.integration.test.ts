import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SOCKET_EVENTS, type FeedEventItem } from '@visor-protect/shared';
import { InProcessAlertBroker } from '../../infrastructure/redis/InProcessAlertBroker';
import type { AlertService } from '../../application/services/AlertService';
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

describe('AlertService — unificación legacy new_report', () => {
  let memoryServer: MongoMemoryServer;
  let harness: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let alertService: AlertService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());

    const broker = new InProcessAlertBroker();
    harness = await createAlertTestHarness(broker, 'legacy-report-test');
    ({ alertService } = createTestAlertService(harness));
  });

  beforeEach(async () => {
    await seedDemoShops();
  });

  afterAll(async () => {
    await harness.close();
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it('new_report INTRUSION-equivalente (SUSPICIOUS_PERSON) no notifica a B sin suscripción', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    let feedReceived = false;
    socketB.on(SOCKET_EVENTS.FEED_UPDATES, () => {
      feedReceived = true;
    });

    const { feedItem, alertEvent, recipientCount } = await alertService.processLegacyReport({
      shopId: SHOP_A_ID,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      category: 'SUSPICIOUS_PERSON',
    });

    expect(recipientCount).toBe(0);
    expect(feedItem.event_type).toBe('REEL_REPORT');
    expect(alertEvent.type).toBe('SOSPECHOSO');
    expect(alertEvent.severity).toBe('MEDIA');
    expect(alertEvent.metadata.event_log_id).toBe(feedItem.id);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(feedReceived).toBe(false);

    socketB.disconnect();
  });

  it('new_report tipo ROBO notifica a B suscrito vía feed_updates', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const feedPromise = waitForSocketEvent<FeedEventItem>(socketB, SOCKET_EVENTS.FEED_UPDATES);

    const { alertEvent, recipientCount } = await alertService.processLegacyReport({
      shopId: SHOP_A_ID,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      iconType: 'theft',
      description: 'Intento de robo detectado en estacionamiento',
    });

    expect(alertEvent.type).toBe('ROBO');
    expect(recipientCount).toBe(1);

    const feed = await feedPromise;
    expect(feed.event_type).toBe('REEL_REPORT');

    socketB.disconnect();
  });
});
