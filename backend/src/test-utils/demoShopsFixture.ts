import mongoose from 'mongoose';
import { DEMO_CITY } from '@visor-protect/shared';
import { ShopModel } from '../infrastructure/database/mongodb/models/Shop.model';
import { DEMO_SHOPS_GEO_PATCH } from '../infrastructure/database/mongodb/demoShopGeo';

export const SHOP_A_ID = '00000000-0000-4000-8000-000000000001';
export const SHOP_B_ID = '00000000-0000-4000-8000-000000000002';
export const SHOP_C_ID = '00000000-0000-4000-8000-000000000003';

const DEMO_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000099');

const ACTIVE_SUBSCRIPTION = {
  status: 'ACTIVE' as const,
  trialEndsAt: new Date('2099-01-01T00:00:00.000Z'),
};

/** Comercio A y B ~50 m en Balneário Camboriú; C en Rio (fuera de geocerca). */
export const DEMO_SHOPS = DEMO_SHOPS_GEO_PATCH.map((shop) => ({
  ...shop,
  subscribed_event_types:
    shop._id === SHOP_B_ID
      ? (['ROBO', 'EMERGENCIA'] as const)
      : (['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'] as const),
  subscription: ACTIVE_SUBSCRIPTION,
}));

export async function seedDemoShops(): Promise<void> {
  await ShopModel.deleteMany({});
  await ShopModel.syncIndexes();
  for (const shop of DEMO_SHOPS) {
    await ShopModel.create({
      ...shop,
      owner_id: DEMO_OWNER_ID,
      socket_id: null,
    });
  }
}

export const SHOP_A_LOCATION = {
  lat: DEMO_SHOPS_GEO_PATCH[0].location.coordinates[1],
  lng: DEMO_SHOPS_GEO_PATCH[0].location.coordinates[0],
};

export { DEMO_CITY };
