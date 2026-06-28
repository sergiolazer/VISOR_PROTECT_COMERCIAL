import {
  buildSubscriptionSnapshot,
  createTrialSubscription,
  type NetworkShopPin,
  type ShopSubscriptionStatus,
} from '@visor-protect/shared';
import type { IShopRepository } from '../../../../domain/repositories/IShopRepository';
import type { CreateShopParams, ShopRecord } from '../../../../domain/entities/ShopRecord';
import { ShopModel, type IShopDocument } from '../models/Shop.model';

function resolveSubscriptionFields(shop: {
  subscription?: { status: ShopSubscriptionStatus; trialEndsAt: Date };
  createdAt?: Date;
}): { status: ShopSubscriptionStatus; trialEndsAt: Date } {
  if (shop.subscription?.status && shop.subscription.trialEndsAt) {
    return {
      status: shop.subscription.status,
      trialEndsAt: new Date(shop.subscription.trialEndsAt),
    };
  }

  return {
    status: 'ACTIVE',
    trialEndsAt: shop.createdAt ? new Date(shop.createdAt) : new Date(),
  };
}

function mapShopDocument(
  shop: Pick<IShopDocument, '_id' | 'name' | 'city' | 'subscription' | 'createdAt' | 'location'>,
): ShopRecord {
  const { status, trialEndsAt } = resolveSubscriptionFields(shop);
  const coords = shop.location?.coordinates;

  return {
    id: shop._id,
    name: shop.name,
    city: shop.city,
    ...(coords && coords.length === 2
      ? { location: { lng: coords[0], lat: coords[1] } }
      : {}),
    subscription: buildSubscriptionSnapshot(status, trialEndsAt),
  };
}

export class MongoShopRepository implements IShopRepository {
  async findById(shopId: string): Promise<ShopRecord | null> {
    const shop = await ShopModel.findById(shopId).lean();
    if (!shop) {
      return null;
    }

    return mapShopDocument(shop);
  }

  async create(params: CreateShopParams): Promise<ShopRecord> {
    const subscription = params.subscription ?? createTrialSubscription();

    const shop = await ShopModel.create({
      _id: params.id,
      name: params.name,
      address: params.address,
      city: params.city,
      location: {
        type: 'Point',
        coordinates: [params.lng, params.lat],
      },
      owner_id: params.ownerId,
      socket_id: null,
      subscription,
    });

    return mapShopDocument(shop);
  }

  async updateMercadoPagoPreapprovalId(shopId: string, preapprovalId: string | null): Promise<void> {
    await ShopModel.findByIdAndUpdate(shopId, {
      $set: { 'subscription.mercado_pago_preapproval_id': preapprovalId },
    });
  }

  async updateSubscriptionStatus(
    shopId: string,
    update: { status: ShopSubscriptionStatus; trialEndsAt?: Date },
  ): Promise<void> {
    const set: Record<string, unknown> = {
      'subscription.status': update.status,
    };

    if (update.trialEndsAt) {
      set['subscription.trialEndsAt'] = update.trialEndsAt;
    }

    await ShopModel.findByIdAndUpdate(shopId, { $set: set });
  }

  async updateSocketId(shopId: string, socketId: string | null): Promise<void> {
    await ShopModel.findByIdAndUpdate(shopId, {
      socket_id: socketId,
      updatedAt: new Date(),
    });
  }

  async clearSocketId(socketId: string): Promise<void> {
    await ShopModel.updateOne({ socket_id: socketId }, { socket_id: null });
  }

  async findNearby(params: {
    lng: number;
    lat: number;
    radiusMeters: number;
    excludeShopId?: string;
    city?: string;
  }): Promise<ShopRecord[]> {
    const query: Record<string, unknown> = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [params.lng, params.lat] },
          $maxDistance: params.radiusMeters,
        },
      },
    };

    if (params.excludeShopId) {
      query._id = { $ne: params.excludeShopId };
    }

    if (params.city?.trim()) {
      query.city = params.city.trim();
    }

    const shops = await ShopModel.find(query).limit(50).lean();

    return shops.map((shop) => mapShopDocument(shop));
  }

  async findNetworkByCity(city: string): Promise<NetworkShopPin[]> {
    const normalizedCity = city.trim();
    if (!normalizedCity) {
      return [];
    }

    const shops = await ShopModel.find({ city: normalizedCity })
      .select('_id name city location socket_id')
      .lean();

    return shops.flatMap((shop) => {
      const coords = shop.location?.coordinates;
      if (!coords || coords.length !== 2) {
        return [];
      }

      return [
        {
          id: shop._id,
          name: shop.name,
          city: shop.city,
          location: { lng: coords[0], lat: coords[1] },
          is_online: Boolean(shop.socket_id),
        },
      ];
    });
  }
}
