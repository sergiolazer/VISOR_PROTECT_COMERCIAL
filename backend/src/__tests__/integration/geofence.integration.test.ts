import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GeofenceService } from '../../application/services/GeofenceService';
import { MongoShopRepository } from '../../infrastructure/database/mongodb/repositories/MongoShopRepository';
import { ShopModel } from '../../infrastructure/database/mongodb/models/Shop.model';
import {
  seedDemoShops,
  SHOP_A_ID,
  SHOP_B_ID,
  SHOP_C_ID,
  SHOP_A_LOCATION,
} from '../../test-utils/demoShopsFixture';

describe('GeofenceService (integración)', () => {
  let memoryServer: MongoMemoryServer;
  let geofenceService: GeofenceService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
    geofenceService = new GeofenceService(new MongoShopRepository());
  });

  beforeEach(async () => {
    await seedDemoShops();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it('incluye comercio B (~50 m) y excluye comercio C (otra ciudad)', async () => {
    const { shopIds } = await geofenceService.resolveRecipientShopIds({
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      senderShopId: SHOP_A_ID,
      city: 'São Paulo',
    });

    expect(shopIds).toContain(SHOP_B_ID);
    expect(shopIds).not.toContain(SHOP_A_ID);
    expect(shopIds).not.toContain(SHOP_C_ID);
  });

  it('no notifica comercios fuera del radio aunque compartan ciudad', async () => {
    await ShopModel.updateOne(
      { _id: SHOP_C_ID },
      {
        $set: {
          city: 'São Paulo',
          location: { type: 'Point', coordinates: [-46.5000, -23.5000] },
        },
      },
    );

    const { shopIds } = await geofenceService.resolveRecipientShopIds({
      lat: SHOP_A_LOCATION.lat,
      lng: SHOP_A_LOCATION.lng,
      senderShopId: SHOP_A_ID,
      city: 'São Paulo',
      radiusMeters: 500,
    });

    expect(shopIds).toContain(SHOP_B_ID);
    expect(shopIds).not.toContain(SHOP_C_ID);
  });
});
