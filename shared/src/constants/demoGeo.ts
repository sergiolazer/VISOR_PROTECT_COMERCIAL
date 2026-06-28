/** Ciudad piloto — Balneário Camboriú, SC */
export const DEMO_CITY = 'Balneário Camboriú';

/** Centro del mapa (Av. Atlântica / orla). */
export const DEMO_MAP_CENTER = {
  lat: -26.9909,
  lng: -48.6348,
} as const;

/** Comercios demo A y B ~50 m en la misma ciudad. */
export const DEMO_SHOP_GEO = {
  centro: {
    address: 'Av. Atlântica 2540, Balneário Camboriú',
    lat: -26.9909,
    lng: -48.6348,
  },
  cercano: {
    address: 'Av. Atlântica 2590, Balneário Camboriú',
    lat: -26.9906,
    lng: -48.6345,
  },
  lejano: {
    address: 'Centro, Rio de Janeiro',
    city: 'Rio de Janeiro',
    lat: -22.9068,
    lng: -43.1729,
  },
} as const;
