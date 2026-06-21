import { getAlertRadiusMeters, type UrgencyLevel } from '@visor-protect/shared';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';

export interface ResolveRecipientsInput {
  lat: number;
  lng: number;
  senderShopId: string;
  city?: string;
  urgencyLevel?: UrgencyLevel;
  radiusMeters?: number;
}

export class GeofenceService {
  constructor(private readonly shopRepository: IShopRepository) {}

  async resolveRecipientShopIds(input: ResolveRecipientsInput): Promise<{
    shopIds: string[];
    radiusMeters: number;
  }> {
    const radiusMeters =
      input.radiusMeters ?? getAlertRadiusMeters(input.urgencyLevel);

    const shops = await this.shopRepository.findNearby({
      lng: input.lng,
      lat: input.lat,
      radiusMeters,
      excludeShopId: input.senderShopId,
      city: input.city,
    });

    return {
      shopIds: shops.map((shop) => shop.id),
      radiusMeters,
    };
  }
}
