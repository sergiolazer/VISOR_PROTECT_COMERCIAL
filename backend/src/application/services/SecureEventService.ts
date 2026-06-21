import { ShopContextService } from './ShopContextService';
import type { AlertService } from './AlertService';
import type {
  AlertType,
  FeedEventItem,
  QuickReportCategory,
  ReelIconType,
  UrgencyLevel,
} from '@visor-protect/shared';

export interface NewReportInput {
  shopId: string;
  category?: QuickReportCategory;
  description?: string;
  lat: number;
  lng: number;
  iconType?: ReelIconType;
  senderSocketId?: string;
}

export interface EmergencyAlertInput {
  shopId: string;
  alertType: AlertType;
  urgencyLevel: UrgencyLevel;
  lat: number;
  lng: number;
  description?: string;
  senderSocketId?: string;
}

export interface DispatchResult {
  feedItem: FeedEventItem;
  recipientCount?: number;
}

export class SecureEventService {
  constructor(
    private readonly alertService: AlertService,
    private readonly shopContextService: ShopContextService,
  ) { }

  async processNewReport(input: NewReportInput): Promise<DispatchResult> {
    await this.shopContextService.resolveShop(input.shopId);

    const { feedItem, recipientCount } = await this.alertService.processLegacyReport({
      shopId: input.shopId,
      category: input.category,
      description: input.description,
      lat: input.lat,
      lng: input.lng,
      iconType: input.iconType,
      excludeSocketId: input.senderSocketId,
    });

    return { feedItem, recipientCount };
  }

  async processEmergencyAlert(input: EmergencyAlertInput): Promise<DispatchResult> {
    await this.shopContextService.resolveShop(input.shopId);

    const { feedItem, recipientCount } = await this.alertService.processLegacyEmergencyAlert({
      shopId: input.shopId,
      alertType: input.alertType,
      urgencyLevel: input.urgencyLevel,
      lat: input.lat,
      lng: input.lng,
      description: input.description,
      excludeSocketId: input.senderSocketId,
    });

    return { feedItem, recipientCount };
  }
}
