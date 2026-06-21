import mongoose from 'mongoose';
import type {
  AlertFilterRejection,
  AlertFilterRejectionReason,
} from '@visor-protect/shared';
import type {
  AlertRecipientRecord,
  ExplainShopFilterParams,
  FindEligibleRecipientsParams,
  RecipientResolutionResult,
} from '../../../../domain/entities/AlertRecipient';
import type { IAlertRecipientRepository } from '../../../../domain/repositories/IAlertRecipientRepository';
import { ShopModel } from '../models/Shop.model';

const CRITICAL_SEVERITY = 'CRITICA';

type GeoShopRow = {
  _id: string;
  name: string;
  city: string;
  distance_meters: number;
  subscribed_event_types: string[];
};

export class MongoAlertRecipientRepository implements IAlertRecipientRepository {
  async findEligibleRecipients(
    params: FindEligibleRecipientsParams,
  ): Promise<AlertRecipientRecord[]> {
    const { eligible } = await this.resolveRecipientsWithAudit(params);
    return eligible;
  }

  async resolveRecipientsWithAudit(
    params: FindEligibleRecipientsParams,
  ): Promise<RecipientResolutionResult> {
    const inRadius = await this.findShopsInRadius(params);
    const eligible = this.applySubscriptionFilter(inRadius, params);
    const eligibleIds = new Set(eligible.map((shop) => shop.shopId));

    const rejected: AlertFilterRejection[] = inRadius
      .filter((shop) => !eligibleIds.has(shop.shopId))
      .map((shop) => ({
        shopId: shop.shopId,
        shopName: shop.shopName,
        reason: 'SUBSCRIPTION' as AlertFilterRejectionReason,
        eventType: params.eventType,
        distanceMeters: shop.distanceMeters,
        radiusMeters: params.radiusMeters,
        subscribedEventTypes: shop.subscribedEventTypes,
      }));

    return {
      eligible,
      rejected,
      inRadiusCount: inRadius.length,
    };
  }

  async explainShopFilter(params: ExplainShopFilterParams): Promise<AlertFilterRejection | null> {
    const { targetShopId, excludeShopId, eventType, severity, radiusMeters, city } = params;

    if (targetShopId === excludeShopId) {
      return {
        shopId: targetShopId,
        reason: 'SENDER_EXCLUDED',
        eventType,
      };
    }

    const shop = await ShopModel.findById(targetShopId).lean();
    if (!shop) {
      return {
        shopId: targetShopId,
        reason: 'SHOP_NOT_FOUND',
        eventType,
      };
    }

    if (city?.trim() && shop.city.trim() !== city.trim()) {
      return {
        shopId: targetShopId,
        shopName: shop.name,
        reason: 'CITY_MISMATCH',
        eventType,
        subscribedEventTypes: shop.subscribed_event_types ?? [],
      };
    }

    const distanceRows = await ShopModel.aggregate<GeoShopRow>([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [params.lng, params.lat] },
          distanceField: 'distance_meters',
          spherical: true,
          query: { _id: targetShopId },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          city: 1,
          distance_meters: 1,
          subscribed_event_types: 1,
        },
      },
    ]);

    const distanceRow = distanceRows[0];
    if (!distanceRow) {
      return {
        shopId: targetShopId,
        shopName: shop.name,
        reason: 'SHOP_NOT_FOUND',
        eventType,
      };
    }

    const distanceMeters = Math.round(distanceRow.distance_meters);

    if (distanceMeters > radiusMeters) {
      return {
        shopId: targetShopId,
        shopName: shop.name,
        reason: 'OUT_OF_RADIUS',
        eventType,
        distanceMeters,
        radiusMeters,
        subscribedEventTypes: distanceRow.subscribed_event_types ?? [],
      };
    }

    if (severity !== CRITICAL_SEVERITY) {
      const subscribed = distanceRow.subscribed_event_types ?? [];
      if (!subscribed.includes(eventType)) {
        return {
          shopId: targetShopId,
          shopName: shop.name,
          reason: 'SUBSCRIPTION',
          eventType,
          distanceMeters,
          radiusMeters,
          subscribedEventTypes: subscribed,
        };
      }
    }

    return null;
  }

  private async findShopsInRadius(
    params: FindEligibleRecipientsParams,
  ): Promise<AlertRecipientRecord[]> {
    const baseQuery: Record<string, unknown> = {
      _id: { $ne: params.excludeShopId },
    };

    if (params.city?.trim()) {
      baseQuery.city = params.city.trim();
    }

    const pipeline: mongoose.PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [params.lng, params.lat] },
          distanceField: 'distance_meters',
          maxDistance: params.radiusMeters,
          spherical: true,
          query: baseQuery,
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          city: 1,
          distance_meters: 1,
          subscribed_event_types: 1,
        },
      },
      { $limit: 50 },
    ];

    const results = await ShopModel.aggregate<GeoShopRow>(pipeline);
    return results.map((shop) => this.mapGeoRow(shop));
  }

  private applySubscriptionFilter(
    shops: AlertRecipientRecord[],
    params: FindEligibleRecipientsParams,
  ): AlertRecipientRecord[] {
    if (params.severity === CRITICAL_SEVERITY) {
      return shops;
    }

    return shops.filter((shop) => shop.subscribedEventTypes.includes(params.eventType));
  }

  private mapGeoRow(shop: GeoShopRow): AlertRecipientRecord {
    return {
      shopId: shop._id,
      shopName: shop.name,
      city: shop.city,
      distanceMeters: Math.round(shop.distance_meters),
      subscribedEventTypes: shop.subscribed_event_types ?? [],
    };
  }
}
