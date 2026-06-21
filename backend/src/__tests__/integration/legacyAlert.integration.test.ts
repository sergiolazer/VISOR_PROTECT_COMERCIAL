import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SOCKET_EVENTS, type AlertPushNotificationDto, type FeedEventItem } from '@visor-protect/shared';
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

describe('AlertService — unificación legacy emergency_alert', () => {
  let memoryServer: MongoMemoryServer;
  let harness: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let alertService: AlertService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());

    const broker = new InProcessAlertBroker();
    harness = await createAlertTestHarness(broker, 'legacy-unify-test');
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

  it('emergency_alert legacy crea EventLog + AlertEvent y notifica con alert_push y panic_alerts', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    const pushPromise = waitForSocketEvent<AlertPushNotificationDto>(
      socketB,
      SOCKET_EVENTS.ALERT_PUSH,
    );
    const panicPromise = waitForSocketEvent<FeedEventItem>(socketB, SOCKET_EVENTS.PANIC_ALERTS);

    const { feedItem, alertEvent, recipientCount } = await alertService.processLegacyEmergencyAlert({
      shopId: SHOP_A_ID,
      alertType: 'ROBO',
      urgencyLevel: 'CRITICAL',
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      description: 'Intento de robo detectado en acceso principal',
    });

    expect(recipientCount).toBe(1);
    expect(feedItem.event_type).toBe('PANIC_ALERT');
    expect(feedItem.id).toBeDefined();
    expect(alertEvent.metadata.event_log_id).toBe(feedItem.id);
    expect(alertEvent.severity).toBe('CRITICA');
    expect(alertEvent.type).toBe('ROBO');

    const push = await pushPromise;
    expect(push.eventId).toBe(alertEvent.id);
    expect(push.distance).toBeGreaterThan(0);

    const panic = await panicPromise;
    expect(panic.id).toBe(feedItem.id);
    expect(panic.alert_type).toBe('ROBO');

    socketB.disconnect();
  });
});
