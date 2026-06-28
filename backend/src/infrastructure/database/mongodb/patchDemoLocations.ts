import { connectMongoDB, disconnectMongoDB } from './connection';
import { ShopModel } from './models/Shop.model';
import { EventLogModel } from './models/EventLog.model';
import { DEMO_CITY } from '@visor-protect/shared';
import { DEMO_SHOPS_GEO_PATCH } from './demoShopGeo';

/** Actualiza ciudad/ubicación de comercios demo sin borrar usuarios ni mensajes. */
export async function patchDemoShopLocations(): Promise<void> {
  for (const shop of DEMO_SHOPS_GEO_PATCH) {
    const result = await ShopModel.updateOne(
      { _id: shop._id },
      {
        $set: {
          name: shop.name,
          address: shop.address,
          city: shop.city,
          location: shop.location,
        },
      },
    );

    if (result.matchedCount > 0) {
      console.log(`[Patch] ${shop._id} → ${shop.city} (${shop.address})`);
    }
  }

  await EventLogModel.updateMany(
    {
      shop_id: { $in: DEMO_SHOPS_GEO_PATCH.filter((s) => s.city === DEMO_CITY).map((s) => s._id) },
      city: { $ne: DEMO_CITY },
    },
    { $set: { city: DEMO_CITY } },
  );
}

async function main(): Promise<void> {
  await connectMongoDB();
  await patchDemoShopLocations();
  console.log('[Patch] Ubicaciones demo actualizadas a Balneário Camboriú');
  await disconnectMongoDB();
}

main().catch((error) => {
  console.error('[Patch] Error:', error);
  process.exit(1);
});
