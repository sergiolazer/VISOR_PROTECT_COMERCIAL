import type { GeoLocation } from './alert';

export interface NetworkShopPin {
  id: string;
  name: string;
  city: string;
  location: GeoLocation;
  is_online: boolean;
}

export interface NetworkSnapshotPayload {
  city: string;
  shops: NetworkShopPin[];
}

export interface NetworkPresencePayload {
  shop_id: string;
  shop_name: string;
  is_online: boolean;
  location?: GeoLocation;
}
