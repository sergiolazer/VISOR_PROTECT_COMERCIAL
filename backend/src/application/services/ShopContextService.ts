import type { ShopRecord } from '../../domain/entities/ShopRecord';
import { AlertValidationError, ALERT_ERROR_CODES } from '../../domain/errors/AlertValidationError';

export interface ResolvedShopContext extends ShopRecord {
  shopName: string;
}

export class ShopContextService {
  constructor(private readonly getShopById: (shopId: string) => Promise<ShopRecord | null>) {}

  async resolveShop(shopId: string): Promise<ResolvedShopContext> {
    const shop = await this.getShopById(shopId);

    if (!shop) {
      throw new AlertValidationError(
        'Comercio no encontrado',
        ALERT_ERROR_CODES.SHOP_NOT_FOUND,
      );
    }

    return {
      ...shop,
      shopName: shop.name,
    };
  }

  assertShopIdPresent(shopId: string | undefined): asserts shopId is string {
    if (!shopId) {
      throw new AlertValidationError(
        'Contexto de comercio no disponible. Autentique con un token válido.',
        ALERT_ERROR_CODES.SHOP_NOT_REGISTERED,
      );
    }
  }
}
