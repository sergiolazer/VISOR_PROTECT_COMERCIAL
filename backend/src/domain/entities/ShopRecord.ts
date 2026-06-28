import type { ShopSubscriptionSnapshot } from '@visor-protect/shared';

export interface ShopRecord {
  id: string;
  name: string;
  city: string;
  location?: { lat: number; lng: number };
  subscription: ShopSubscriptionSnapshot;
}

export interface CreateShopParams {
  id: string;
  name: string;
  address: string;
  city: string;
  lng: number;
  lat: number;
  ownerId: string;
  subscription?: {
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    trialEndsAt: Date;
  };
}
