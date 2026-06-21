import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@visor-protect/shared';
import { InProcessAlertBroker } from '../../infrastructure/redis/InProcessAlertBroker';
import {
  connectShopClient,
  createAlertTestHarness,
  waitForConnect,
} from '../../test-utils/alertTestHarness';
import { createTestAlertService } from '../../test-utils/createTestAlertService';
import {
  seedDemoShops,
  SHOP_A_ID,
  SHOP_B_ID,
  SHOP_C_ID,
  SHOP_A_LOCATION,
} from '../../test-utils/demoShopsFixture';
import { AuditLogModel } from '../../infrastructure/database/mongodb/models/AuditLog.model';

describe('AlertService — telemetría de filtro e isLegacyReplay', () => {
  let memoryServer: MongoMemoryServer;
  let harness: Awaited<ReturnType<typeof createAlertTestHarness>>;
  let alertService: ReturnType<typeof createTestAlertService>['alertService'];

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());

    const broker = new InProcessAlertBroker();
    harness = await createAlertTestHarness(broker, 'filter-telemetry-test');
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

  it('registra rechazo SUBSCRIPTION cuando B está en radio pero no suscrito al tipo', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    await alertService.processLegacyReport({
      shopId: SHOP_A_ID,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      category: 'SUSPICIOUS_PERSON',
    });

    const rejectionLog = debugSpy.mock.calls.find(
      ([message, payload]) =>
        message === '[AlertFilterTelemetry] rejection' &&
        typeof payload === 'string' &&
        payload.includes(SHOP_B_ID) &&
        payload.includes('SUBSCRIPTION'),
    );

    expect(rejectionLog).toBeDefined();
    debugSpy.mockRestore();
  });

  it('explainDeliveryForShop identifica CITY_MISMATCH para comercio en otra ciudad', async () => {
    const { alertEvent } = await alertService.processLegacyReport({
      shopId: SHOP_A_ID,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      iconType: 'theft',
      description: 'Intento de robo detectado en acceso principal',
      isLegacyReplay: true,
    });

    const rejection = await alertService.explainDeliveryForShop(alertEvent.id, SHOP_C_ID);

    expect(rejection?.reason).toBe('CITY_MISMATCH');
    expect(rejection?.shopId).toBe(SHOP_C_ID);
  });

  it('isLegacyReplay persiste historial sin emitir feed_updates', async () => {
    const socketB = connectShopClient(harness.url, SHOP_B_ID);
    await waitForConnect(socketB);

    let feedReceived = false;
    socketB.on(SOCKET_EVENTS.FEED_UPDATES, () => {
      feedReceived = true;
    });

    const { alertEvent, feedItem } = await alertService.processLegacyReport({
      shopId: SHOP_A_ID,
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      iconType: 'theft',
      description: 'Backfill histórico de robo en vitrina',
      isLegacyReplay: true,
    });

    expect(feedItem.id).toBeDefined();
    expect(alertEvent.metadata.is_legacy_replay).toBe(true);

    const audit = await AuditLogModel.findOne({
      shop_id: SHOP_A_ID,
      action: 'LEGACY_ALERT_REPLAY',
    }).lean();
    expect(audit).toBeTruthy();
    expect(audit?.metadata?.alert_event_id).toBe(alertEvent.id);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(feedReceived).toBe(false);

    socketB.disconnect();
  });
});
