import { DEMO_CITY, DEMO_SHOP_GEO } from '@visor-protect/shared';

export const DEMO_SHOP_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const;

export const DEMO_SHOPS_GEO_PATCH = [
  {
    _id: DEMO_SHOP_IDS[0],
    name: 'Comercio Demo Centro',
    address: DEMO_SHOP_GEO.centro.address,
    city: DEMO_CITY,
    location: {
      type: 'Point' as const,
      coordinates: [DEMO_SHOP_GEO.centro.lng, DEMO_SHOP_GEO.centro.lat],
    },
  },
  {
    _id: DEMO_SHOP_IDS[1],
    name: 'Comercio Demo Cercano',
    address: DEMO_SHOP_GEO.cercano.address,
    city: DEMO_CITY,
    location: {
      type: 'Point' as const,
      coordinates: [DEMO_SHOP_GEO.cercano.lng, DEMO_SHOP_GEO.cercano.lat],
    },
  },
  {
    _id: DEMO_SHOP_IDS[2],
    name: 'Comercio Demo Lejano',
    address: DEMO_SHOP_GEO.lejano.address,
    city: DEMO_SHOP_GEO.lejano.city,
    location: {
      type: 'Point' as const,
      coordinates: [DEMO_SHOP_GEO.lejano.lng, DEMO_SHOP_GEO.lejano.lat],
    },
  },
];
