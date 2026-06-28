import type { ShopSubscriptionStatus } from '@visor-protect/shared';
import type { NetworkShopPin } from '@visor-protect/shared';
import type { CreateShopParams, ShopRecord } from '../entities/ShopRecord';

export interface FindNearbyShopsParams {
  lng: number;
  lat: number;
  radiusMeters: number;
  excludeShopId?: string;
  city?: string;
}

export interface ShopSubscriptionUpdate {
  status: ShopSubscriptionStatus;
  trialEndsAt?: Date;
}

export interface IShopRepository {
  findById(shopId: string): Promise<ShopRecord | null>;
  create(params: CreateShopParams): Promise<ShopRecord>;
  updateSubscriptionStatus(shopId: string, update: ShopSubscriptionUpdate): Promise<void>;
  updateMercadoPagoPreapprovalId(shopId: string, preapprovalId: string | null): Promise<void>;
  updateSocketId(shopId: string, socketId: string | null): Promise<void>;
  clearSocketId(socketId: string): Promise<void>;
  findNearby(params: FindNearbyShopsParams): Promise<ShopRecord[]>;
  findNetworkByCity(city: string): Promise<NetworkShopPin[]>;
}
