import {
  citiesMatch,
  type EmergencyAlertPayload,
  type PanicAlertPayload,
  type QuickReportPayload,
  type ReelReportPayload,
} from '@visor-protect/shared';
import {
  ALERT_ERROR_CODES,
  AlertValidationError,
} from '../../domain/errors/AlertValidationError';
import type { IShopRepository } from '../../domain/repositories/IShopRepository';
import type { ShopRecord } from '../../domain/entities/ShopRecord';

export interface ValidateAlertSenderParams {
  alert: EmergencyAlertPayload;
  registeredShopId?: string;
}

export interface ValidateReelReportParams {
  report: ReelReportPayload;
  registeredShopId?: string;
}

export interface ValidatePanicAlertParams {
  alert: PanicAlertPayload;
  registeredShopId?: string;
}

export interface ValidateQuickReportParams {
  report: QuickReportPayload;
  registeredShopId?: string;
}

export class AlertSenderValidator {
  constructor(private readonly shopRepository: IShopRepository) {}

  async validateAndEnrich(params: ValidateAlertSenderParams): Promise<EmergencyAlertPayload> {
    const shop = await this.validateShopEmitter({
      senderShopId: params.alert.sender_shop_id,
      senderShopName: params.alert.sender_shop_name,
      city: params.alert.city,
      registeredShopId: params.registeredShopId,
    });

    return { ...params.alert, city: shop.city, sender_shop_name: shop.name };
  }

  async validateReelReport(params: ValidateReelReportParams): Promise<ReelReportPayload> {
    const shop = await this.validateShopEmitter({
      senderShopId: params.report.sender_shop_id,
      senderShopName: params.report.sender_shop_name,
      city: params.report.city,
      registeredShopId: params.registeredShopId,
    });

    return { ...params.report, city: shop.city, sender_shop_name: shop.name };
  }

  async validatePanicAlert(params: ValidatePanicAlertParams): Promise<PanicAlertPayload> {
    const shop = await this.validateShopEmitter({
      senderShopId: params.alert.sender_shop_id,
      senderShopName: params.alert.sender_shop_name,
      city: params.alert.city,
      registeredShopId: params.registeredShopId,
    });

    return { ...params.alert, city: shop.city, sender_shop_name: shop.name };
  }

  async validateQuickReport(params: ValidateQuickReportParams): Promise<{
    city: string;
    senderShopId: string;
    senderShopName: string;
    category: QuickReportPayload['category'];
    location: { lat: number; lng: number };
  }> {
    if (!params.registeredShopId) {
      throw new AlertValidationError(
        'El comercio debe estar registrado antes de emitir reportes',
        ALERT_ERROR_CODES.SHOP_NOT_REGISTERED,
      );
    }

    const shop = await this.shopRepository.findById(params.registeredShopId);

    if (!shop) {
      throw new AlertValidationError(
        'Comercio emisor no encontrado',
        ALERT_ERROR_CODES.SHOP_NOT_FOUND,
      );
    }

    return {
      city: shop.city,
      senderShopId: shop.id,
      senderShopName: shop.name,
      category: params.report.category,
      location: { lat: params.report.lat, lng: params.report.lng },
    };
  }

  async validateCityForShop(shopId: string, cityName: string): Promise<string> {
    const shop = await this.shopRepository.findById(shopId);

    if (!shop) {
      throw new AlertValidationError(
        'Comercio no encontrado',
        ALERT_ERROR_CODES.SHOP_NOT_FOUND,
      );
    }

    if (!citiesMatch(cityName, shop.city)) {
      throw new AlertValidationError(
        `No puede unirse a "${cityName}". Su comercio está registrado en "${shop.city}"`,
        ALERT_ERROR_CODES.CITY_MISMATCH,
      );
    }

    return shop.city;
  }

  private async validateShopEmitter(params: {
    senderShopId: string;
    senderShopName: string;
    city: string;
    registeredShopId?: string;
  }): Promise<ShopRecord> {
    const { senderShopId, senderShopName, city, registeredShopId } = params;

    if (!registeredShopId) {
      throw new AlertValidationError(
        'El comercio debe estar registrado antes de emitir eventos',
        ALERT_ERROR_CODES.SHOP_NOT_REGISTERED,
      );
    }

    if (registeredShopId !== senderShopId) {
      throw new AlertValidationError(
        'El socket no está autorizado para emitir eventos de este comercio',
        ALERT_ERROR_CODES.UNAUTHORIZED_SENDER,
      );
    }

    const shop = await this.shopRepository.findById(senderShopId);

    if (!shop) {
      throw new AlertValidationError(
        'Comercio emisor no encontrado',
        ALERT_ERROR_CODES.SHOP_NOT_FOUND,
      );
    }

    if (!citiesMatch(city, shop.city)) {
      throw new AlertValidationError(
        `La ciudad del payload (${city}) no coincide con la registrada (${shop.city})`,
        ALERT_ERROR_CODES.CITY_MISMATCH,
      );
    }

    if (senderShopName.trim() !== shop.name.trim()) {
      throw new AlertValidationError(
        'El nombre del comercio no coincide con el registrado en el sistema',
        ALERT_ERROR_CODES.SHOP_NAME_MISMATCH,
      );
    }

    return shop;
  }
}
