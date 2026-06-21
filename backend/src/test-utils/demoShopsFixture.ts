import mongoose from 'mongoose';
import { ShopModel } from '../infrastructure/database/mongodb/models/Shop.model';

export const SHOP_A_ID = '00000000-0000-4000-8000-000000000001';
export const SHOP_B_ID = '00000000-0000-4000-8000-000000000002';
export const SHOP_C_ID = '00000000-0000-4000-8000-000000000003';

const DEMO_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000099');

const ACTIVE_SUBSCRIPTION = {
  status: 'ACTIVE' as const,
  trialEndsAt: new Date('2099-01-01T00:00:00.000Z'),
};

/** Comercio A y B ~50 m en São Paulo; C en Rio de Janeiro (fuera de geocerca). */
export const DEMO_SHOPS = [
  {
    _id: SHOP_A_ID,
    name: 'Comercio Demo Centro',
    address: 'Av. Paulista 1000, São Paulo',
    city: 'São Paulo',
    location: { type: 'Point' as const, coordinates: [-46.6553, -23.5614] },
    subscribed_event_types: ['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'],
    subscription: ACTIVE_SUBSCRIPTION,
  },
  {
    _id: SHOP_B_ID,
    name: 'Comercio Demo Cercano',
    address: 'Av. Paulista 1050, São Paulo',
    city: 'São Paulo',
    location: { type: 'Point' as const, coordinates: [-46.6548, -23.5610] },
    subscribed_event_types: ['ROBO', 'EMERGENCIA'],
    subscription: ACTIVE_SUBSCRIPTION,
  },
  {
    _id: SHOP_C_ID,
    name: 'Comercio Demo Lejano',
    address: 'Rua Augusta 500, São Paulo',
    city: 'Rio de Janeiro',
    location: { type: 'Point' as const, coordinates: [-43.1729, -22.9068] },
    subscribed_event_types: ['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'],
    subscription: ACTIVE_SUBSCRIPTION,
  },
];

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

export const SHOP_A_LOCATION = { lat: -23.5614, lng: -46.6553 };
