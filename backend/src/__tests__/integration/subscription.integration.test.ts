import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SUBSCRIPTION_ERROR_CODES } from '@visor-protect/shared';
import { syncMongoIndexes } from '../../infrastructure/database/mongodb/syncIndexes';
import { MongoShopRepository } from '../../infrastructure/database/mongodb/repositories/MongoShopRepository';
import { SubscriptionService } from '../../application/services/SubscriptionService';
import { createTestAlertService } from '../../test-utils/createTestAlertService';
import { InProcessAlertBroker } from '../../infrastructure/redis/InProcessAlertBroker';
import { createAlertTestHarness } from '../../test-utils/alertTestHarness';
import { SHOP_A_ID, SHOP_A_LOCATION, seedDemoShops } from '../../test-utils/demoShopsFixture';
import { ShopModel } from '../../infrastructure/database/mongodb/models/Shop.model';

describe('SubscriptionService — trial 15 días y lazy check', () => {
  let mongoServer: MongoMemoryServer;
  let shopRepository: MongoShopRepository;
  let subscriptionService: SubscriptionService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await syncMongoIndexes();
    shopRepository = new MongoShopRepository();
    subscriptionService = new SubscriptionService(shopRepository);
    await seedDemoShops();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('createShopWithTrial asigna TRIAL con trialEndsAt +15 días', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const shop = await subscriptionService.createShopWithTrial({
      name: 'Nuevo Comercio Trial',
      address: 'Rua Test 1',
      city: 'São Paulo',
      lat: -23.55,
      lng: -46.63,
      ownerId,
    });

    expect(shop.subscription.status).toBe('TRIAL');
    expect(shop.subscription.daysRemaining).toBeGreaterThanOrEqual(14);
    expect(shop.subscription.daysRemaining).toBeLessThanOrEqual(15);
    expect(shop.subscription.canEmitAlerts).toBe(true);
  });

  it('lazy check convierte TRIAL expirado a PAST_DUE', async () => {
    const shopId = '00000000-0000-4000-8000-000000000099';
    await ShopModel.create({
      _id: shopId,
      name: 'Trial Expirado',
      address: 'Test',
      city: 'São Paulo',
      location: { type: 'Point', coordinates: [-46.65, -23.56] },
      owner_id: new mongoose.Types.ObjectId(),
      subscription: {
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const snapshot = await subscriptionService.refreshSubscriptionState(shopId);
    expect(snapshot.status).toBe('PAST_DUE');
    expect(snapshot.canEmitAlerts).toBe(false);
    expect(snapshot.requiresPayment).toBe(true);
  });

  it('assertCanEmitAlerts bloquea alertas en PAST_DUE', async () => {
    const shopId = '00000000-0000-4000-8000-000000000098';
    await ShopModel.create({
      _id: shopId,
      name: 'Past Due Shop',
      address: 'Test',
      city: 'São Paulo',
      location: { type: 'Point', coordinates: [-46.65, -23.56] },
      owner_id: new mongoose.Types.ObjectId(),
      subscription: {
        status: 'PAST_DUE',
        trialEndsAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });

    await expect(subscriptionService.assertCanEmitAlerts(shopId)).rejects.toMatchObject({
      code: SUBSCRIPTION_ERROR_CODES.TRIAL_EXPIRED,
    });
  });

  it('comercio ACTIVE (demo) puede emitir alertas', async () => {
    const broker = new InProcessAlertBroker();
    const harness = await createAlertTestHarness(broker, 'test-subscription');
    const { alertService } = createTestAlertService(harness);

    try {
      const result = await alertService.createAndBroadcast({
        shopId: SHOP_A_ID,
        type: 'ROBO',
        severity: 'MEDIA',
        lat: SHOP_A_LOCATION.lat,
        lng: SHOP_A_LOCATION.lng,
        description: 'Prueba suscripción activa',
      });

      expect(result.event.shopId).toBe(SHOP_A_ID);
    } finally {
      await harness.close();
    }
  });
});
